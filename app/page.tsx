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
  const [attachedFiles, setAttachedFiles] =
    useState<Attachment[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] =
    useState(false);

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
  }

  function handleSend() {
    if (!input.trim() || isGenerating) return;

    const fileIds = attachedFiles.map(
      (file) => file.id
    );

    sendMessage(
      input,
      model,
      fileIds,
      webSearchEnabled,
      attachedFiles
    );

    setInput('');
    setAttachedFiles([]);
  }

  async function handleShare() {
    if (!conversationId) {
      window.alert(
        'Send a message first before sharing this conversation.'
      );
      return;
    }

    try {
      const response = await fetch(
        `/api/conversations/${conversationId}`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            share: true
          })
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error ||
            'Failed to create share link.'
        );
      }

      const token =
        data?.conversation?.shareToken;

      if (
        typeof token !== 'string' ||
        !token
      ) {
        throw new Error(
          'Share token was not returned.'
        );
      }

      const shareUrl =
        `${window.location.origin}/api/share/${token}`;

      await navigator.clipboard.writeText(
        shareUrl
      );

      window.alert(
        'Share link copied to clipboard.'
      );
    } catch (error) {
      window.alert(
        error instanceof Error
          ? error.message
          : 'Failed to create share link.'
      );
    }
  }

  const firstMessage = messages[0];

  const title = firstMessage
    ? firstMessage.content
        .replace(/\s+/g, ' ')
        .slice(0, 48)
    : 'New chat';

  return (
    <AppShell>
      <ChatHeader title={title} />

      {messages.length === 0 ? (
        <EmptyState
          onSuggestion={handleSuggestion}
        />
      ) : (
        <MessageList
          messages={messages}
          isGenerating={isGenerating}
          onRegenerate={(id) =>
            regenerate(id, model)
          }
          onEdit={(id, content) =>
            editMessage(
              id,
              content,
              model
            )
          }
          onShare={handleShare}
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
        onAttachedFilesChange={
          setAttachedFiles
        }
        webSearchEnabled={
          webSearchEnabled
        }
        onWebSearchEnabledChange={
          setWebSearchEnabled
        }
      />
    </AppShell>
  );
}
