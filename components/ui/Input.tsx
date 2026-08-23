import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border border-slate-border dark:border-slate-border-dark bg-white dark:bg-surface-dark-raised px-3.5 text-sm text-ink dark:text-paper placeholder:text-slate-light outline-none transition-colors focus:border-cobalt',
        className
      )}
      {...props}
    />
  )
);
Input.displayName = 'Input';

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      'w-full resize-none rounded-xl border border-slate-border dark:border-slate-border-dark bg-white dark:bg-surface-dark-raised px-3.5 py-2.5 text-sm text-ink dark:text-paper placeholder:text-slate-light outline-none transition-colors focus:border-cobalt',
      className
    )}
    {...props}
  />
));
Textarea.displayName = 'Textarea';
