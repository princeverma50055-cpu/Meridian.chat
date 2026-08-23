import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

type Tone = 'cobalt' | 'neutral' | 'success' | 'warning';

const toneStyles: Record<Tone, string> = {
  cobalt: 'bg-cobalt/10 text-cobalt',
  neutral: 'bg-surface-light dark:bg-surface-dark-raised text-slate',
  success: 'bg-emerald-500/10 text-emerald-600',
  warning: 'bg-amber-500/10 text-amber-600'
};

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium',
        toneStyles[tone]
      )}
    >
      {children}
    </span>
  );
}
