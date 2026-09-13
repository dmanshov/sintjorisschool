'use server';

import { createHash, randomBytes } from 'node:crypto';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { and, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { env } from '@/lib/env';
import { passwordResetMail, sendMail, welcomeMail } from '@/lib/mail';
import { passwordResetTokens, users } from '@db/schema';
import {
  burnPasswordTime,
  hashPassword,
  validatePasswordStrength,
  verifyPassword,
} from './password';
import { checkLoginRate, recordLoginAttempt } from './rate-limit';
import {
  createSession,
  destroyAllSessionsFor,
  destroyCurrentSession,
  pruneExpiredSessions,
  requireUser,
} from './session';

export type FormState = { error?: string; success?: string } | null;

async function clientIp(): Promise<string | null> {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() ?? h.get('x-real-ip') ?? null;
}

function normaliseEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

// ─────────────────────────────────────────────────────────────────────────────
// Login
// ─────────────────────────────────────────────────────────────────────────────
export async function loginAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normaliseEmail(formData.get('email'));
  const password = String(formData.get('password') ?? '');
  const next = String(formData.get('next') ?? '/home');

  if (!email || !password) {
    return { error: 'Vul je email adres en wachtwoord in.' };
  }

  const ip = await clientIp();
  const rate = await checkLoginRate(email, ip);
  if (!rate.allowed) {
    return {
      error: `Te veel mislukte pogingen. Probeer het over ${rate.minutes} minuten opnieuw, of vraag een nieuw wachtwoord aan.`,
    };
  }

  const rows = await db
    .select()
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  const user = rows[0];

  if (!user) {
    // Spend comparable CPU so response time does not reveal whether the email
    // is registered.
    await burnPasswordTime(password);
    await recordLoginAttempt(email, ip, false);
    return { error: 'Je email adres of wachtwoord is niet correct, probeer even opnieuw.' };
  }

  if (user.disabled) {
    await recordLoginAttempt(email, ip, false);
    return { error: 'Dit profiel is geblokkeerd. Neem contact op met de school.' };
  }

  const result = await verifyPassword(password, user);

  if (!result.ok) {
    await recordLoginAttempt(email, ip, false);
    if (result.reason === 'no-password') {
      return {
        error:
          'Dit profiel heeft nog geen wachtwoord. Vraag hieronder een nieuw wachtwoord aan via "wachtwoord vergeten".',
      };
    }
    if (result.reason === 'legacy-params-missing') {
      return {
        error:
          'Aanmelden is tijdelijk niet mogelijk door een technisch probleem. De school is verwittigd.',
      };
    }
    return { error: 'Je email adres of wachtwoord is niet correct, probeer even opnieuw.' };
  }

  // Correct password. Upgrade a legacy Firebase hash to our own format, so this
  // account no longer depends on Firebase being reachable or on those params.
  if (result.rehashTo) {
    await db
      .update(users)
      .set({
        passwordHash: result.rehashTo,
        legacyFirebaseHash: null,
        legacyFirebaseSalt: null,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id));
  }

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));
  await recordLoginAttempt(email, ip, true);

  const userAgent = (await headers()).get('user-agent');
  await createSession(user.id, userAgent);
  await pruneExpiredSessions();

  redirect(safeNext(next));
}

/** Only allow redirects back into this site. */
function safeNext(next: string): string {
  return next.startsWith('/') && !next.startsWith('//') ? next : '/home';
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────
export async function registerAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = normaliseEmail(formData.get('email'));
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('passwordConfirm') ?? '');
  const accepted = formData.get('privacy') === 'on';

  if (!email || !email.includes('@')) return { error: 'Vul een geldig email adres in.' };
  if (!accepted) {
    return { error: 'Verklaar eerst dat je akkoord gaat met de privacyverklaring.' };
  }
  const strength = validatePasswordStrength(password);
  if (strength) return { error: strength };
  if (password !== confirm) return { error: 'Je wachtwoord kon niet bevestigd worden.' };

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);

  if (existing.length > 0) {
    // Do not confirm that the address is registered. Point at the reset flow,
    // which is useful to the legitimate owner and useless to anyone else.
    return {
      error:
        'Er bestaat al een profiel met dit email adres. Meld je aan, of vraag een nieuw wachtwoord aan.',
    };
  }

  const id = randomBytes(16).toString('hex');
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    admin: false,
    teacher: false,
  });

  await sendMail(welcomeMail(email));
  await createSession(id, (await headers()).get('user-agent'));
  redirect('/profiel?welkom=1');
}

// ─────────────────────────────────────────────────────────────────────────────
// Logout
// ─────────────────────────────────────────────────────────────────────────────
export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  revalidatePath('/', 'layout');
  redirect('/');
}

// ─────────────────────────────────────────────────────────────────────────────
// Password reset
// ─────────────────────────────────────────────────────────────────────────────
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const email = normaliseEmail(formData.get('email'));
  if (!email) return { error: 'Vul je email adres in.' };

  const rows = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(sql`lower(${users.email}) = ${email}`)
    .limit(1);
  const user = rows[0];

  if (user) {
    const token = randomBytes(32).toString('base64url');
    await db.insert(passwordResetTokens).values({
      tokenHash: hashToken(token),
      userId: user.id,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });
    const url = `${env.siteUrl}/wachtwoord-herstellen?token=${encodeURIComponent(token)}`;
    await sendMail(passwordResetMail(user.email, url));
  }

  // Same answer whether or not the address exists, so the form cannot be used
  // to enumerate which parents have an account.
  return { success: 'We stuurden je een email met verdere instructies.' };
}

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const token = String(formData.get('token') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('passwordConfirm') ?? '');

  if (!token) return { error: 'Deze link is niet geldig. Vraag een nieuwe aan.' };
  const strength = validatePasswordStrength(password);
  if (strength) return { error: strength };
  if (password !== confirm) return { error: 'Je wachtwoord kon niet bevestigd worden.' };

  const rows = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, hashToken(token)),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, new Date()),
      ),
    )
    .limit(1);
  const record = rows[0];

  if (!record) {
    return { error: 'Deze link is verlopen of al gebruikt. Vraag een nieuwe aan.' };
  }

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      legacyFirebaseHash: null,
      legacyFirebaseSalt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, record.userId));

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(passwordResetTokens.tokenHash, record.tokenHash));

  // Anyone already holding a session for this account loses it. If the reset
  // happened because the account was compromised, that is the point.
  await destroyAllSessionsFor(record.userId);
  await createSession(record.userId, (await headers()).get('user-agent'));

  redirect('/profiel?wachtwoord=1');
}

/** Change password while logged in. */
export async function changePasswordAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const user = await requireUser();
  const current = String(formData.get('currentPassword') ?? '');
  const password = String(formData.get('password') ?? '');
  const confirm = String(formData.get('passwordConfirm') ?? '');

  const verified = await verifyPassword(current, user);
  if (!verified.ok) return { error: 'Je huidige wachtwoord is niet correct.' };

  const strength = validatePasswordStrength(password);
  if (strength) return { error: strength };
  if (password !== confirm) return { error: 'Je nieuwe wachtwoord kon niet bevestigd worden.' };

  await db
    .update(users)
    .set({
      passwordHash: await hashPassword(password),
      legacyFirebaseHash: null,
      legacyFirebaseSalt: null,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id));

  return { success: 'Je wachtwoord werd aangepast.' };
}
