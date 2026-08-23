import { cn } from '@/lib/utils/cn';

interface MeridianMarkProps {
  /** When true, the vertical line pulses to indicate the AI is actively generating. */
  active?: boolean;
  size?: number;
  className?: string;
}

/**
 * The Meridian brand mark: a circle bisected by a vertical line.
 * The same line is reused throughout the product as the streaming/thinking
 * indicator, so the mark and the "AI is working" state are the same idea.
 */
export function MeridianMark({ active = false, size = 24, className }: MeridianMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={cn('shrink-0', className)}
      role="img"
      aria-label="Meridian"
    >
      <circle cx="12" cy="12" r="9.25" stroke="#3654FF" strokeWidth="1.5" />
      <line
        x1="12"
        y1="3.5"
        x2="12"
        y2="20.5"
        stroke="#3654FF"
        strokeWidth="1.5"
        strokeLinecap="round"
        className={cn(active && 'origin-center animate-pulse-line')}
      />
    </svg>
  );
}
