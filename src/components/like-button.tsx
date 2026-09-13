'use client';

import { useFormStatus } from 'react-dom';

export function LikeButton({ liked, count }: { liked: boolean; count: number }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={liked}
      aria-label={liked ? 'Niet langer leuk vinden' : 'Leuk vinden'}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm transition-colors disabled:opacity-60 ${
        liked ? 'bg-danger/10 text-danger' : 'text-ink-muted hover:bg-canvas hover:text-danger'
      }`}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill={liked ? 'currentColor' : 'none'} aria-hidden="true">
        <path
          d="M12 20s-7-4.5-7-9.5A4.5 4.5 0 0112 7a4.5 4.5 0 017 3.5c0 5-7 9.5-7 9.5z"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span aria-hidden="true">{count}</span>
    </button>
  );
}
