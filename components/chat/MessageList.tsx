'use client';

import { useEffect, useRef } from 'react';

import { ChatMessageItem } from '@/components/chat/ChatMessage';
import { TypingIndicator } from '@/components/chat/TypingIndicator';

import type { ChatMessage } from '@/lib/types/chat';

interface MessageListProps {
  messages: ChatMessage[];
  isGenerating?: boolean;
  onRegenerate: (id: string) => void;
  onEdit: (id: string, content: string) => void;
  onShare?: (id: string) => void;
}

export function MessageList({
  messages,
  isGenerating = false,
  onRegenerate,
  onEdit,
  onShare
}: MessageListProps) {
  const containerRef =
    useRef<HTMLDivElement>(null);

  const wasNearBottomRef =
    useRef(true);

  const rafRef =
    useRef<number | null>(null);

  /*
   * Track whether the person is currently near the bottom of the
   * scroll area. If they've scrolled up to reread something, we
   * must NOT yank them back down while new tokens stream in.
   */
  function handleScroll() {
    const el = containerRef.current;

    if (!el) return;

    const distanceFromBottom =
      el.scrollHeight -
      el.scrollTop -
      el.clientHeight;

    wasNearBottomRef.current =
      distanceFromBottom < 120;
  }

  useEffect(() => {
    const el = containerRef.current;

    if (!el || !wasNearBottomRef.current) {
      return;
    }

    /*
     * IMPORTANT: scroll the container directly via scrollTop,
     * never scrollIntoView(). scrollIntoView can walk up and
     * nudge ancestor scroll positions (including the page
     * itself on some mobile browsers), which is what caused the
     * composer to visually "float away" while a response was
     * streaming in. Setting scrollTop only ever affects this
     * one element.
     *
     * Also coalesced through requestAnimationFrame so rapid,
     * per-token updates during streaming collapse into at most
     * one scroll per frame instead of stacking dozens of smooth
     * scroll animations per second.
     */
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight;
    });

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, [
    messages.length,
    messages[messages.length - 1]?.content
  ]);

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto overscroll-contain scrollbar-thin"
    >
      <div className="mx-auto w-full max-w-chat py-4">
        {messages.map((message) => (
          <ChatMessageItem
            key={message.id}
            message={message}
            onRegenerate={() =>
              onRegenerate(message.id)
            }
            onEdit={(content) =>
              onEdit(
                message.id,
                content
              )
            }
            onShare={() =>
              onShare?.(message.id)
            }
          />
        ))}

        {isGenerating &&
          !messages.some(
            (message) =>
              message.isStreaming
          ) && (
            <TypingIndicator className="px-4 py-3" />
          )}
      </div>
    </div>
  );
}
