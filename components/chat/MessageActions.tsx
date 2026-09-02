'use client';

import {
  Check,
  Copy,
  Pencil,
  RotateCcw,
  Share2,
  ThumbsDown,
  ThumbsUp
} from 'lucide-react';
import { useState } from 'react';

import { Tooltip } from '@/components/ui/Tooltip';
import { cn } from '@/lib/utils/cn';

interface MessageActionsProps {
  message: string;
  isUser?: boolean;
  onEdit?: () => void;
  onRegenerate?: () => void;
  onShare?: () => void;
  className?: string;
}

export function MessageActions({
  message,
  isUser = false,
  onEdit,
  onRegenerate,
  onShare,
  className
}: MessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);

  async function handleCopy() {
    if (!message.trim()) return;

    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);

      window.setTimeout(() => {
        setCopied(false);
      }, 1500);
    } catch {
      setCopied(false);
    }
  }

  function handleFeedback(type: 'up' | 'down') {
    setFeedback((current) => (current === type ? null : type));
  }

  return (
    <div
      className={cn(
        'flex items-center gap-0.5',
        className
      )}
    >
      <Tooltip content="Copy">
        <button
          type="button"
          onClick={handleCopy}
          aria-label="Copy message"
          className={cn(
            'rounded-lg p-1.5 text-slate transition-colors',
            'hover:bg-surface-light hover:text-ink',
            'dark:hover:bg-surface-dark-raised dark:hover:text-paper'
          )}
        >
          {copied ? (
            <Check size={14} />
          ) : (
            <Copy size={14} />
          )}
        </button>
      </Tooltip>

      {isUser ? (
        <>
          {onEdit && (
            <Tooltip content="Edit">
              <button
                type="button"
                onClick={onEdit}
                aria-label="Edit message"
                className={cn(
                  'rounded-lg p-1.5 text-slate transition-colors',
                  'hover:bg-surface-light hover:text-ink',
                  'dark:hover:bg-surface-dark-raised dark:hover:text-paper'
                )}
              >
                <Pencil size={14} />
              </button>
            </Tooltip>
          )}
        </>
      ) : (
        <>
          {onRegenerate && (
            <Tooltip content="Regenerate">
              <button
                type="button"
                onClick={onRegenerate}
                aria-label="Regenerate response"
                className={cn(
                  'rounded-lg p-1.5 text-slate transition-colors',
                  'hover:bg-surface-light hover:text-ink',
                  'dark:hover:bg-surface-dark-raised dark:hover:text-paper'
                )}
              >
                <RotateCcw size={14} />
              </button>
            </Tooltip>
          )}

          <Tooltip content="Good response">
            <button
              type="button"
              onClick={() => handleFeedback('up')}
              aria-label="Good response"
              aria-pressed={feedback === 'up'}
              className={cn(
                'rounded-lg p-1.5 text-slate transition-colors',
                'hover:bg-surface-light hover:text-ink',
                'dark:hover:bg-surface-dark-raised dark:hover:text-paper',
                feedback === 'up' &&
                  'bg-cobalt/10 text-cobalt hover:text-cobalt'
              )}
            >
              <ThumbsUp size={14} />
            </button>
          </Tooltip>

          <Tooltip content="Bad response">
            <button
              type="button"
              onClick={() => handleFeedback('down')}
              aria-label="Bad response"
              aria-pressed={feedback === 'down'}
              className={cn(
                'rounded-lg p-1.5 text-slate transition-colors',
                'hover:bg-surface-light hover:text-ink',
                'dark:hover:bg-surface-dark-raised dark:hover:text-paper',
                feedback === 'down' &&
                  'bg-cobalt/10 text-cobalt hover:text-cobalt'
              )}
            >
              <ThumbsDown size={14} />
            </button>
          </Tooltip>

          {onShare && (
            <Tooltip content="Share">
              <button
                type="button"
                onClick={onShare}
                aria-label="Share message"
                className={cn(
                  'rounded-lg p-1.5 text-slate transition-colors',
                  'hover:bg-surface-light hover:text-ink',
                  'dark:hover:bg-surface-dark-raised dark:hover:text-paper'
                )}
              >
                <Share2 size={14} />
              </button>
            </Tooltip>
          )}
        </>
      )}
    </div>
  );
}
