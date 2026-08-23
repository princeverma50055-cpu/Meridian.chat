'use client';

import { useEffect, useRef } from 'react';
import { ChatMessageItem } from '@/components/chat/ChatMessage';
import type { ChatMessage } from '@/lib/types/chat';

export function MessageList({
  messages,
  onRegenerate,
  onEdit
}: {
  messages: ChatMessage[];
  onRegenerate: (id: string) => void;
  onEdit: (id: string, content: string) => void;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, messages[messages.length - 1]?.content]);

  return (
    <div className="flex-1 overflow-y-auto scrollbar-thin">
      <div className="mx-auto w-full max-w-chat py-4">
        {messages.map((message) => (
          <ChatMessageItem
            key={message.id}
            message={message}
            onRegenerate={() => onRegenerate(message.id)}
            onEdit={(content) => onEdit(message.id, content)}
          />
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
