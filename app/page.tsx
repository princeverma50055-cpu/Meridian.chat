'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { EmptyState } from '@/components/chat/EmptyState';
import { MessageList } from '@/components/chat/MessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { useChat } from '@/lib/hooks/useChat';
import type { Attachment } from '@/lib/types/chat';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('meridian-fast');
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  const {
    messages,
    isGenerating,
    sendMessage,
    regenerate,
    stop,
    editMessage,
    conversationId
  } = useChat();

  function handleSuggestion(prompt: string) {
    setInput(prompt);

    // Focus the composer after selecting a suggestion.
    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Ask anything..."]'
      );

      textarea?.focus();
    });
  }

  function handleSend() {
    const message = input.trim();

    if (!message || isGenerating) {
      return;
    }

    const fileIds = attachedFiles.map((file) => file.id);

    sendMessage(
      message,
      model,
      fileIds,
      webSearchEnabled,
      attachedFiles
    );

    setInput('');
    setAttachedFiles([]);
  }

  const firstMessage = messages[0];

  const title = firstMessage
    ? firstMessage.content.slice(0, 48)
    : 'New chat';

  return (
    <AppShell activeConversationId={conversationId}>
      <div className="flex h-full min-h-0 flex-col">
        <div className="shrink-0">
          <ChatHeader title={title} />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {messages.length === 0 ? (
            <EmptyState onSuggestion={handleSuggestion} />
          ) : (
            <MessageList
              messages={messages}
              onRegenerate={(id) => regenerate(id, model)}
              onEdit={(id, content) =>
                editMessage(id, content, model)
              }
            />
          )}
        </div>

        <div className="shrink-0">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={handleSend}
            isGenerating={isGenerating}
            onStop={stop}
            model={model}
            onModelChange={setModel}
            conversationId={conversationId}
            onAttachedFilesChange={setAttachedFiles}
            webSearchEnabled={webSearchEnabled}
            onWebSearchEnabledChange={setWebSearchEnabled}
          />
        </div>
      </div>
    </AppShell>
  );
}
