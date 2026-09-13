'use client';

import { useFormStatus } from 'react-dom';

/** A submit button that disables itself and says what it is doing. */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  className = '',
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
}) {
  const { pending } = useFormStatus();

  const styles = {
    primary: 'bg-primary text-white hover:bg-primary-soft',
    secondary: 'border border-primary text-primary hover:bg-primary hover:text-white',
    danger: 'bg-danger text-white hover:brightness-95',
    ghost: 'text-ink-muted hover:bg-canvas hover:text-primary',
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${styles} ${className}`}
    >
      {pending && pendingLabel ? pendingLabel : children}
    </button>
  );
}

/** Inline result of a server action, announced to screen readers. */
export function FormMessage({ state }: { state: { error?: string; success?: string } | null }) {
  if (!state?.error && !state?.success) return null;
  const isError = Boolean(state.error);
  return (
    <p
      role="status"
      aria-live="polite"
      className={`mt-3 rounded-lg px-3 py-2 text-sm ${
        isError ? 'bg-danger/10 text-danger' : 'bg-success/10 text-success'
      }`}
    >
      {isError ? state.error : state.success}
    </p>
  );
}

/**
 * Confirmation for destructive submits. The old app opened a dialog per action;
 * a native confirm keeps the same guard without a modal tree, and still works
 * if JavaScript fails to load (the submit simply proceeds, which for a delete
 * button the user deliberately pressed is the lesser evil).
 */
export function ConfirmSubmit({
  children,
  message,
  variant = 'danger',
  className = '',
}: {
  children: React.ReactNode;
  message: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  className?: string;
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: 'bg-primary text-white hover:bg-primary-soft',
    secondary: 'border border-primary text-primary hover:bg-primary hover:text-white',
    danger: 'bg-danger text-white hover:brightness-95',
    ghost: 'text-ink-muted hover:bg-canvas hover:text-primary',
  }[variant];

  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-60 ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
