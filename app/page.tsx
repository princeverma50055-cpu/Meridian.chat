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
  const [deepResearchEnabled, setDeepResearchEnabled] = useState(false);

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

    requestAnimationFrame(() => {
      const textarea = document.querySelector<HTMLTextAreaElement>(
        'textarea[placeholder="Ask anything..."]'
      );

      textarea?.focus();
    });
  }

  function handleSend() {
    const text = input.trim();

    if (!text || isGenerating) {
      return;
    }

    const fileIds = attachedFiles.map((file) => file.id);

    sendMessage(
      text,
      model,
      fileIds,
      webSearchEnabled,
      attachedFiles,
      deepResearchEnabled
    );

    setInput('');
    setAttachedFiles([]);
  }

  function handleRegenerate(messageId: string) {
    regenerate(
      messageId,
      model,
      undefined,
      webSearchEnabled,
      deepResearchEnabled
    );
  }

  function handleEdit(messageId: string, content: string) {
    editMessage(
      messageId,
      content,
      model,
      undefined,
      webSearchEnabled,
      deepResearchEnabled
    );
  }

  const firstMessage = messages[0];

  const title = firstMessage
    ? firstMessage.content.slice(0, 48) || 'New chat'
    : 'New chat';

  return (
    <AppShell>
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
              onRegenerate={handleRegenerate}
              onEdit={handleEdit}
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
            deepResearchEnabled={deepResearchEnabled}
            onDeepResearchEnabledChange={setDeepResearchEnabled}
          />
        </div>
      </div>
    </AppShell>
  );
}
