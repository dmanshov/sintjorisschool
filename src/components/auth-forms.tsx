'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import {
  loginAction,
  registerAction,
  requestPasswordResetAction,
  resetPasswordAction,
  type FormState,
} from '@/lib/auth/actions';
import { documents } from '@/lib/site';
import { FormMessage, SubmitButton } from './ui';

const inputClass =
  'mt-1.5 w-full rounded-lg border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-muted/60 focus:border-primary';

export function LoginRegisterTabs({ next }: { next: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');

  return (
    <div className="card p-6 sm:p-8">
      <div
        role="tablist"
        aria-label="Aanmelden of registreren"
        className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1"
      >
        {(['login', 'register'] as const).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
              mode === value ? 'bg-surface text-primary shadow-sm' : 'text-ink-muted hover:text-primary'
            }`}
          >
            {value === 'login' ? 'Inloggen' : 'Registreren'}
          </button>
        ))}
      </div>

      {mode === 'login' ? <LoginForm next={next} /> : <RegisterForm />}
    </div>
  );
}

function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, null);

  return (
    <form action={action} noValidate>
      <input type="hidden" name="next" value={next} />

      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Vul hier jouw email adres in..."
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Wachtwoord</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          placeholder="Vul hier jouw wachtwoord in..."
          className={inputClass}
        />
      </label>

      <FormMessage state={state} />

      <div className="mt-6">
        <SubmitButton pendingLabel="Aanmelden…" className="w-full">
          Inloggen
        </SubmitButton>
      </div>

      <p className="mt-4 text-center text-sm">
        <Link
          href="/wachtwoord-vergeten"
          className="text-ink-muted underline-offset-2 hover:text-primary hover:underline"
        >
          Oeps, wachtwoord vergeten. Wat nu?
        </Link>
      </p>
    </form>
  );
}

function RegisterForm() {
  const [state, action] = useActionState<FormState, FormData>(registerAction, null);

  return (
    <form action={action} noValidate>
      <label className="block">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Vul hier jouw email adres in..."
          className={inputClass}
        />
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Wachtwoord</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Kies een wachtwoord..."
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-ink-muted">Minstens 8 tekens.</span>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Herhaal wachtwoord</span>
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Herhaal je wachtwoord..."
          className={inputClass}
        />
      </label>

      <label className="mt-5 flex items-start gap-3 text-sm">
        <input type="checkbox" name="privacy" className="mt-0.5 size-4 shrink-0 accent-[#54363c]" />
        <span>
          Door een account aan te maken ga ik akkoord met de{' '}
          <a
            href={documents.privacyverklaring}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline-offset-2 hover:underline"
          >
            privacyverklaring
          </a>
          .
        </span>
      </label>

      <FormMessage state={state} />

      <div className="mt-6">
        <SubmitButton pendingLabel="Profiel aanmaken…" className="w-full">
          Registreren
        </SubmitButton>
      </div>
    </form>
  );
}

export function ForgotPasswordForm() {
  const [state, action] = useActionState<FormState, FormData>(requestPasswordResetAction, null);

  return (
    <form action={action} noValidate className="card p-6 sm:p-8">
      <p className="text-[15px] leading-relaxed text-ink-muted">
        Wachtwoord vergeten? Dat kan gebeuren. Vul je email adres in en we helpen je graag verder.
      </p>

      <label className="mt-5 block">
        <span className="text-sm font-medium">Email</span>
        <input
          type="email"
          name="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="Vul hier jouw email adres in..."
          className={inputClass}
        />
      </label>

      <FormMessage state={state} />

      <div className="mt-6">
        <SubmitButton pendingLabel="Versturen…" className="w-full">
          Nieuw wachtwoord aanvragen
        </SubmitButton>
      </div>

      <p className="mt-4 text-center text-sm">
        <Link href="/login" className="text-ink-muted underline-offset-2 hover:text-primary hover:underline">
          Terug naar aanmelden
        </Link>
      </p>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action] = useActionState<FormState, FormData>(resetPasswordAction, null);

  return (
    <form action={action} noValidate className="card p-6 sm:p-8">
      <input type="hidden" name="token" value={token} />

      <label className="block">
        <span className="text-sm font-medium">Nieuw wachtwoord</span>
        <input
          type="password"
          name="password"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Kies een nieuw wachtwoord..."
          className={inputClass}
        />
        <span className="mt-1 block text-xs text-ink-muted">Minstens 8 tekens.</span>
      </label>

      <label className="mt-4 block">
        <span className="text-sm font-medium">Herhaal wachtwoord</span>
        <input
          type="password"
          name="passwordConfirm"
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Herhaal je nieuwe wachtwoord..."
          className={inputClass}
        />
      </label>

      <FormMessage state={state} />

      <div className="mt-6">
        <SubmitButton pendingLabel="Opslaan…" className="w-full">
          Wachtwoord instellen
        </SubmitButton>
      </div>
    </form>
  );
}
