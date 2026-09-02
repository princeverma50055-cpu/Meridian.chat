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
  const bottomRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'end'
    });
  }, [
    messages.length,
    messages[messages.length - 1]?.content
  ]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
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

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
