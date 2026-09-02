'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';

import { useChat } from '@/lib/hooks/useChat';
import type { Attachment } from '@/lib/types/chat';

export default function ConversationPage() {
  const params = useParams<{
    id: string;
  }>();

  const conversationId = params.id;

  const [input, setInput] = useState('');
  const [model, setModel] =
    useState('meridian-fast');
  const [attachedFiles, setAttachedFiles] =
    useState<Attachment[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] =
    useState(false);
  const [loaded, setLoaded] =
    useState(false);

  const {
    messages,
    isGenerating,
    sendMessage,
    regenerate,
    stop,
    editMessage,
    loadConversation
  } = useChat(conversationId);

  useEffect(() => {
    if (!conversationId) return;

    setLoaded(false);

    loadConversation(conversationId)
      .finally(() => {
        setLoaded(true);
      });
  }, [
    conversationId,
    loadConversation
  ]);

  function handleSend() {
    if (
      !input.trim() ||
      isGenerating ||
      !conversationId
    ) {
      return;
    }

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
    : loaded
      ? 'Conversation'
      : 'Loading…';

  return (
    <AppShell>
      <ChatHeader title={title} />

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
