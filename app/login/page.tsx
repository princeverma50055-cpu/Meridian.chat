'use client';

import { signIn } from 'next-auth/react';
import { MeridianMark } from '@/components/ui/MeridianMark';

export default function LoginPage() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-paper px-6 dark:bg-ink">
      <MeridianMark size={40} />
      <h1 className="mt-6 font-display text-2xl font-medium text-ink dark:text-paper">
        Welcome to Meridian
      </h1>
      <p className="mt-2 max-w-sm text-center text-[13.5px] text-slate">
        Sign in to start chatting — your conversations are saved to your account and picked up on
        any device.
      </p>

      <button
        onClick={() => signIn('google', { callbackUrl: '/' })}
        className="mt-8 flex items-center gap-3 rounded-xl border border-slate-border bg-white px-6 py-3 text-[14px] font-medium text-ink shadow-sm transition-colors hover:bg-surface-light dark:border-slate-border-dark dark:bg-surface-dark-raised dark:text-paper dark:hover:bg-surface-dark"
      >
        <svg width="18" height="18" viewBox="0 0 18 18">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84c-.21 1.13-.84 2.09-1.8 2.73v2.27h2.92c1.7-1.57 2.68-3.88 2.68-6.64z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.27c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34C2.44 15.98 5.48 18 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.97 10.71c-.18-.54-.28-1.11-.28-1.71s.1-1.17.28-1.71V4.95H.96C.35 6.17 0 7.55 0 9s.35 2.83.96 4.05l3.01-2.34z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0 5.48 0 2.44 2.02.96 4.95l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58z"
          />
        </svg>
        Continue with Google
      </button>
    </div>
  );
}
