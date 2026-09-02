'use client';

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

import { MeridianMark } from '@/components/ui/MeridianMark';
import { SourceCard } from '@/components/chat/SourceCard';
import { MessageActions } from '@/components/chat/MessageActions';
import { FileAttachments } from '@/components/chat/FileAttachments';

import type { ChatMessage as ChatMessageType } from '@/lib/types/chat';

interface ChatMessageProps {
  message: ChatMessageType;
  onRegenerate?: () => void;
  onEdit?: (newContent: string) => void;
  onShare?: () => void;
}

export function ChatMessageItem({
  message,
  onRegenerate,
  onEdit,
  onShare
}: ChatMessageProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const isUser = message.role === 'user';

  function cancelEdit() {
    setEditing(false);
    setDraft(message.content);
  }

  function submitEdit() {
    const content = draft.trim();

    if (!content) return;

    onEdit?.(content);
    setEditing(false);
  }

  if (isUser) {
    return (
      <div className="flex justify-end px-4 py-2">
        <div className="group max-w-[85%] sm:max-w-[70%]">
          {message.attachments &&
            message.attachments.length > 0 && (
              <div className="mb-1.5 flex justify-end">
                <FileAttachments
                  files={message.attachments}
                  compact
                />
              </div>
            )}

          {editing ? (
            <div className="rounded-2xl border border-cobalt/40 bg-white p-3 dark:bg-surface-dark-raised">
              <textarea
                value={draft}
                onChange={(event) =>
                  setDraft(event.target.value)
                }
                className="w-full resize-none bg-transparent text-[14.5px] leading-6 text-ink outline-none dark:text-paper"
                rows={4}
                autoFocus
                maxLength={100000}
              />

              <div className="mt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-lg px-3 py-1.5 text-[12.5px] text-slate transition-colors hover:bg-surface-light dark:hover:bg-surface-dark"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={submitEdit}
                  disabled={!draft.trim()}
                  className="rounded-lg bg-cobalt px-3 py-1.5 text-[12.5px] font-medium text-white transition-colors hover:bg-cobalt-dim disabled:cursor-not-allowed disabled:opacity-50"
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
            <MessageActions
              message={message.content}
              isUser
              onEdit={() => {
                setDraft(message.content);
                setEditing(true);
              }}
              className="mt-1 justify-end opacity-0 transition-opacity group-hover:opacity-100"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="mt-1 shrink-0">
        <MeridianMark
          size={20}
          active={message.isStreaming}
        />
      </div>

      <div className="min-w-0 flex-1">
        <div className="ai-prose text-ink dark:text-paper">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
          >
            {message.content}
          </ReactMarkdown>

          {message.isStreaming && (
            <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse-line bg-cobalt align-middle" />
          )}
        </div>

        {message.sources &&
          message.sources.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-light">
                Sources
              </p>

              <div className="flex flex-wrap gap-2">
                {message.sources.map(
                  (source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                    />
                  )
                )}
              </div>
            </div>
          )}

        {!message.isStreaming && (
          <MessageActions
            message={message.content}
            onRegenerate={onRegenerate}
            onShare={onShare}
            className="mt-2"
          />
        )}
      </div>
    </div>
  );
}
