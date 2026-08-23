'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Copy, RotateCcw, ThumbsUp, ThumbsDown, Share2, Check, Pencil } from 'lucide-react';
import { MeridianMark } from '@/components/ui/MeridianMark';
import { SourceCard } from '@/components/chat/SourceCard';
import type { ChatMessage as ChatMessageType } from '@/lib/types/chat';
import { cn } from '@/lib/utils/cn';

interface ChatMessageProps {
  message: ChatMessageType;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
}

export function ChatMessageItem({ message, onRegenerate, onEdit }: ChatMessageProps) {
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const isUser = message.role === 'user';

  async function handleCopy() {
    await navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="group max-w-[85%] sm:max-w-[70%]">
          {editing ? (
            <div className="rounded-2xl border border-cobalt/40 bg-white p-3 dark:bg-surface-dark-raised">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="w-full resize-none bg-transparent text-[14.5px] outline-none"
                rows={3}
                autoFocus
              />
              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => {
                    setEditing(false);
                    setDraft(message.content);
                  }}
                  className="rounded-lg px-3 py-1 text-[12.5px] text-slate hover:bg-surface-light"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    onEdit?.(draft);
                    setEditing(false);
                  }}
                  className="rounded-lg bg-cobalt px-3 py-1 text-[12.5px] font-medium text-white hover:bg-cobalt-dim"
                >
                  Save & submit
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl bg-surface-light px-4 py-2.5 text-[14.5px] leading-6 text-ink dark:bg-surface-dark-raised dark:text-paper">
              {message.content}
            </div>
          )}

          {!editing && (
            <div className="mt-1 flex justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
              <MessageIconButton icon={<Pencil size={13} />} label="Edit" onClick={() => setEditing(true)} />
              <MessageIconButton
                icon={copied ? <Check size={13} /> : <Copy size={13} />}
                label="Copy"
                onClick={handleCopy}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="mt-1 shrink-0">
        <MeridianMark size={20} active={message.isStreaming} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="ai-prose text-ink dark:text-paper">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          {message.isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse-line bg-cobalt align-middle" />
          )}
        </div>

        {message.sources && message.sources.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-light">
              Sources
            </p>
            <div className="flex flex-wrap gap-2">
              {message.sources.map((source) => (
                <SourceCard key={source.id} source={source} />
              ))}
            </div>
          </div>
        )}

        {!message.isStreaming && (
          <div className="mt-2 flex items-center gap-1">
            <MessageIconButton
              icon={copied ? <Check size={13} /> : <Copy size={13} />}
              label="Copy"
              onClick={handleCopy}
            />
            <MessageIconButton icon={<RotateCcw size={13} />} label="Regenerate" onClick={onRegenerate} />
            <MessageIconButton
              icon={<ThumbsUp size={13} />}
              label="Good response"
              active={feedback === 'up'}
              onClick={() => setFeedback(feedback === 'up' ? null : 'up')}
            />
            <MessageIconButton
              icon={<ThumbsDown size={13} />}
              label="Bad response"
              active={feedback === 'down'}
              onClick={() => setFeedback(feedback === 'down' ? null : 'down')}
            />
            <MessageIconButton icon={<Share2 size={13} />} label="Share" />
          </div>
        )}
      </div>
    </div>
  );
}

function MessageIconButton({
  icon,
  label,
  onClick,
  active
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        'rounded-lg p-1.5 text-slate transition-colors hover:bg-surface-light hover:text-ink dark:hover:bg-surface-dark-raised dark:hover:text-paper',
        active && 'bg-cobalt/10 text-cobalt hover:text-cobalt'
      )}
    >
      {icon}
    </button>
  );
}
