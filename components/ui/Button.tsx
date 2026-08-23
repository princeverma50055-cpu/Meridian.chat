import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';
type Size = 'sm' | 'md' | 'lg' | 'icon';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const variantStyles: Record<Variant, string> = {
  primary: 'bg-cobalt text-white hover:bg-cobalt-dim active:bg-cobalt-dim disabled:bg-cobalt/40',
  secondary:
    'bg-surface-light dark:bg-surface-dark-raised text-ink dark:text-paper hover:bg-slate-border dark:hover:bg-surface-dark',
  ghost:
    'bg-transparent text-ink dark:text-paper hover:bg-surface-light dark:hover:bg-surface-dark-raised',
  outline:
    'bg-transparent border border-slate-border dark:border-slate-border-dark text-ink dark:text-paper hover:bg-surface-light dark:hover:bg-surface-dark-raised',
  danger: 'bg-red-600 text-white hover:bg-red-700'
};

const sizeStyles: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-xl',
  lg: 'h-12 px-5 text-[15px] gap-2 rounded-xl',
  icon: 'h-9 w-9 rounded-lg'
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-cobalt',
          variantStyles[variant],
          sizeStyles[size],
          className
        )}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';
