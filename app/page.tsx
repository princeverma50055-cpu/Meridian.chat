'use client';

import {
  useState
} from 'react';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { EmptyState } from '@/components/chat/EmptyState';
import { MessageList } from '@/components/chat/MessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { useChat } from '@/lib/hooks/useChat';

import type {
  Attachment
} from '@/lib/types/chat';

export default function ChatPage() {
  const [input, setInput] =
    useState('');

  const [model, setModel] =
    useState(
      'meridian-fast'
    );

  const [
    attachedFiles,
    setAttachedFiles
  ] =
    useState<Attachment[]>(
      []
    );

  const [
    webSearchEnabled,
    setWebSearchEnabled
  ] =
    useState(false);

  const [
    deepResearchEnabled,
    setDeepResearchEnabled
  ] =
    useState(false);

  const {
    messages,
    isGenerating,
    sendMessage,
    regenerate,
    stop,
    editMessage,
    conversationId,
    conversationTitle
  } = useChat();

  function handleSuggestion(
    prompt: string
  ) {
    setInput(prompt);
  }

  function handleSend() {
    const trimmed =
      input.trim();

    if (
      !trimmed ||
      isGenerating
    ) {
      return;
    }

    const fileIds =
      attachedFiles
        .map(
          (file) =>
            file.id
        )
        .filter(Boolean);

    sendMessage(
      trimmed,
      model,
      fileIds,
      webSearchEnabled,
      attachedFiles,
      deepResearchEnabled
    );

    setInput('');
    setAttachedFiles([]);
  }

  const title =
    messages.length > 0
      ? conversationTitle ||
        messages[0]?.content
          ?.slice(0, 48) ||
        'New chat'
      : 'New chat';

  return (
    <AppShell
      activeConversationId={
        conversationId
      }
    >
      <div className="flex h-full min-h-0 flex-col">

        <ChatHeader
          title={title}
        />

        <div className="min-h-0 flex-1">
          {messages.length ===
          0 ? (
            <EmptyState
              onSuggestion={
                handleSuggestion
              }
            />
          ) : (
            <MessageList
              messages={
                messages
              }
              onRegenerate={(
                id
              ) =>
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
        </div>

        <div className="shrink-0">
          <ChatComposer
            value={input}
            onChange={setInput}
            onSend={
              handleSend
            }
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
        </div>

      </div>
    </AppShell>
  );
}
