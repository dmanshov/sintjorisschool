import {
  createCipheriv,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from 'node:crypto';
import { promisify } from 'node:util';
import { env } from '@/lib/env';

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem?: number },
) => Promise<Buffer>;

// ─────────────────────────────────────────────────────────────────────────────
// Our own format, used for every password set or re-hashed from now on.
//
//   scrypt$<N>$<r>$<p>$<base64 salt>$<base64 key>
//
// Node's built-in scrypt, so there is no native module to compile and nothing
// that can fail to install on a host. N = 2^16 costs roughly 100 ms of CPU per
// verification on a small serverless instance, which is the right order of
// magnitude for a login form.
// ─────────────────────────────────────────────────────────────────────────────
const SCRYPT_N = 65536;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEYLEN = 32;
const SCRYPT_MAXMEM = 192 * 1024 * 1024;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return [
    'scrypt',
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString('base64'),
    key.toString('base64'),
  ].join('$');
}

async function verifyOwnHash(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, nRaw, rRaw, pRaw, saltB64, keyB64] = parts as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  const N = Number(nRaw);
  const r = Number(rRaw);
  const p = Number(pRaw);
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false;

  const expected = Buffer.from(keyB64, 'base64');
  const actual = await scrypt(password.normalize('NFKC'), Buffer.from(saltB64, 'base64'), expected.length, {
    N,
    r,
    p,
    maxmem: SCRYPT_MAXMEM,
  });
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

// ─────────────────────────────────────────────────────────────────────────────
// Firebase Auth's modified scrypt.
//
// This is what makes the migration invisible to the ~hundreds of parents who
// already have an account. Firebase does not store a plain scrypt digest: it
// derives a key from the password, then uses that key to AES-256-CTR encrypt a
// project-wide "signer key", and stores *that* ciphertext as the password hash.
//
//   derived = scrypt(password, salt || saltSeparator, N = 2^memCost, r = rounds, p = 1, 64 bytes)
//   hash    = AES-256-CTR(key = derived[0..32], iv = 16 zero bytes).encrypt(signerKey)
//
// The four project parameters come from
//   Firebase Console → Authentication → Users → ⋮ → Password hash parameters.
//
// Verified against a real exported hash by `npm run auth:probe` before cutover.
// Do not take this function on trust: run that probe.
// ─────────────────────────────────────────────────────────────────────────────
export type FirebaseHashParams = {
  signerKey: string;
  saltSeparator: string;
  rounds: number;
  memCost: number;
};

export async function verifyFirebaseHash(
  password: string,
  passwordHashB64: string,
  saltB64: string,
  params: FirebaseHashParams,
): Promise<boolean> {
  const salt = Buffer.from(saltB64, 'base64');
  const saltSeparator = Buffer.from(params.saltSeparator, 'base64');
  const signerKey = Buffer.from(params.signerKey, 'base64');

  const derived = await scrypt(password, Buffer.concat([salt, saltSeparator]), 64, {
    N: 2 ** params.memCost,
    r: params.rounds,
    p: 1,
    maxmem: SCRYPT_MAXMEM,
  });

  const cipher = createCipheriv('aes-256-ctr', derived.subarray(0, 32), Buffer.alloc(16, 0));
  const computed = Buffer.concat([cipher.update(signerKey), cipher.final()]);

  const expected = Buffer.from(passwordHashB64, 'base64');
  return expected.length === computed.length && timingSafeEqual(expected, computed);
}

// ─────────────────────────────────────────────────────────────────────────────
// The single entry point the login flow uses.
// ─────────────────────────────────────────────────────────────────────────────
export type PasswordRecord = {
  passwordHash: string | null;
  legacyFirebaseHash: string | null;
  legacyFirebaseSalt: string | null;
};

export type VerifyResult =
  /** Correct password. `rehashTo` is set when the stored form should be upgraded. */
  | { ok: true; rehashTo: string | null }
  /** Wrong password, or the account has no usable password material. */
  | { ok: false; reason: 'mismatch' | 'no-password' | 'legacy-params-missing' };

export async function verifyPassword(
  password: string,
  record: PasswordRecord,
): Promise<VerifyResult> {
  if (record.passwordHash) {
    const ok = await verifyOwnHash(password, record.passwordHash);
    return ok ? { ok: true, rehashTo: null } : { ok: false, reason: 'mismatch' };
  }

  if (record.legacyFirebaseHash && record.legacyFirebaseSalt) {
    const params = env.firebaseHash;
    if (!params) {
      // Fail closed and loudly rather than telling a parent with a correct
      // password that it is wrong: the operator has forgotten to configure
      // FIREBASE_HASH_* and needs to know.
      console.error(
        'A legacy Firebase password hash was presented but FIREBASE_HASH_SIGNER_KEY / ' +
          'FIREBASE_HASH_SALT_SEPARATOR are not configured. Existing users cannot log in.',
      );
      return { ok: false, reason: 'legacy-params-missing' };
    }
    const ok = await verifyFirebaseHash(
      password,
      record.legacyFirebaseHash,
      record.legacyFirebaseSalt,
      params,
    );
    if (!ok) return { ok: false, reason: 'mismatch' };
    // Correct. Upgrade to our own format so this account stops depending on
    // Firebase's parameters.
    return { ok: true, rehashTo: await hashPassword(password) };
  }

  return { ok: false, reason: 'no-password' };
}

/**
 * Constant-ish time padding for the "user does not exist" path, so that login
 * response timing does not reveal whether an email is registered.
 */
export async function burnPasswordTime(password: string): Promise<void> {
  await scrypt(password, randomBytes(16), SCRYPT_KEYLEN, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  }).catch(() => undefined);
}

export function validatePasswordStrength(password: string): string | null {
  if (password.length < 8) return 'Je wachtwoord moet minstens 8 tekens lang zijn.';
  if (password.length > 200) return 'Je wachtwoord is te lang.';
  // Firebase's own minimum was 6 characters, so a handful of existing accounts
  // sit below this. They are not forced to change; this applies to new passwords.
  return null;
}
