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
  const [input, setInput] =
    useState('');

  const [model, setModel] =
    useState('meridian-fast');

  const [attachedFiles, setAttachedFiles] =
    useState<Attachment[]>([]);

  const [webSearchEnabled, setWebSearchEnabled] =
    useState(false);

  const [deepResearchEnabled, setDeepResearchEnabled] =
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

  function handleSuggestion(
    prompt: string
  ) {
    setInput(prompt);
  }

  function handleSend() {
    if (
      !input.trim() ||
      isGenerating
    ) {
      return;
    }

    const fileIds =
      attachedFiles.map(
        (file) => file.id
      );

    sendMessage(
      input,
      model,
      fileIds,
      webSearchEnabled,
      attachedFiles,
      deepResearchEnabled
    );

    setInput('');
    setAttachedFiles([]);
  }

  const firstMessage =
    messages[0];

  const title =
    firstMessage
      ? firstMessage.content.slice(
          0,
          48
        )
      : 'New chat';

  return (
    <AppShell>
      <ChatHeader title={title} />

      {messages.length === 0 ? (
        <EmptyState
          onSuggestion={
            handleSuggestion
          }
        />
      ) : (
        <MessageList
          messages={messages}
          isGenerating={
            isGenerating
          }
          onRegenerate={(id) =>
            regenerate(
              id,
              model,
              undefined,
              webSearchEnabled,
              deepResearchEnabled
            )
          }
          onEdit={(
            id,
            content
          ) =>
            editMessage(
              id,
              content,
              model,
              undefined,
              webSearchEnabled,
              deepResearchEnabled
            )
          }
        />
      )}

      <ChatComposer
        value={input}
        onChange={setInput}
        onSend={handleSend}
        isGenerating={
          isGenerating
        }
        onStop={stop}
        model={model}
        onModelChange={
          setModel
        }
        conversationId={
          conversationId
        }
        onAttachedFilesChange={
          setAttachedFiles
        }
        webSearchEnabled={
          webSearchEnabled
        }
        onWebSearchEnabledChange={
          setWebSearchEnabled
        }
        deepResearchEnabled={
          deepResearchEnabled
        }
        onDeepResearchEnabledChange={
          setDeepResearchEnabled
        }
      />
    </AppShell>
  );
}
