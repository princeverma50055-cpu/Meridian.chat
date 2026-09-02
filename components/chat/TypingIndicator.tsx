'use client';

import { cn } from '@/lib/utils/cn';

interface TypingIndicatorProps {
  label?: string;
  className?: string;
}

export function TypingIndicator({
  label = 'Meridian is thinking',
  className
}: TypingIndicatorProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 px-2 py-2',
        'text-sm text-slate dark:text-slate-light',
        className
      )}
      role="status"
      aria-live="polite"
      aria-label={label}
    >
      <div className="flex items-center gap-1 rounded-full">
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]"
          aria-hidden="true"
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]"
          aria-hidden="true"
        />
        <span
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-current"
          aria-hidden="true"
        />
      </div>

      <span className="text-xs">{label}</span>
    </div>
  );
}
