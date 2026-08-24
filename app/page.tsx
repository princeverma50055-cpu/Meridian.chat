'use client';

import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { EmptyState } from '@/components/chat/EmptyState';
import { MessageList } from '@/components/chat/MessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { useChat } from '@/lib/hooks/useChat';

export default function ChatPage() {
  const [input, setInput] = useState('');
  const [model, setModel] = useState('meridian-fast');
  const [fileIds, setFileIds] = useState<string[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);
  const { messages, isGenerating, sendMessage, regenerate, stop, editMessage, conversationId } =
    useChat();

  function handleSuggestion(prompt: string) {
    setInput(prompt);
  }

  function handleSend() {
    if (!input.trim() || isGenerating) return;
    sendMessage(input, model, fileIds, webSearchEnabled);
    setInput('');
  }

  const title = messages[0]?.content ? messages[0].content.slice(0, 48) : 'New chat';

  return (
    <AppShell activeConversationId={conversationId}>
      <ChatHeader title={title} />
      {messages.length === 0 ? (
        <EmptyState onSuggestion={handleSuggestion} />
      ) : (
        <MessageList
          messages={messages}
          onRegenerate={(id) => regenerate(id, model, fileIds, webSearchEnabled)}
          onEdit={(id, content) => editMessage(id, content, model, fileIds, webSearchEnabled)}
        />
      )}
      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isGenerating={isGenerating}
        onStop={stop}
        model={model}
        onModelChange={setModel}
        conversationId={conversationId}
        onAttachedFileIdsChange={setFileIds}
        webSearchEnabled={webSearchEnabled}
        onWebSearchEnabledChange={setWebSearchEnabled}
      />
    </AppShell>
  );
}
