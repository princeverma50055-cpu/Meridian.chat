'use client';

import {
  useEffect,
  useState
} from 'react';

import {
  useParams
} from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { useChat } from '@/lib/hooks/useChat';

import type {
  Attachment
} from '@/lib/types/chat';

export default function ConversationPage() {
  const params =
    useParams<{
      id: string;
    }>();

  const conversationId =
    typeof params?.id ===
    'string'
      ? params.id
      : '';

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

  const [
    loaded,
    setLoaded
  ] =
    useState(false);

  const {
    messages,
    isGenerating,
    sendMessage,
    regenerate,
    stop,
    editMessage,
    loadConversation,
    conversationTitle
  } =
    useChat(
      conversationId
    );

  useEffect(() => {
    if (
      !conversationId
    ) {
      return;
    }

    let cancelled =
      false;

    setLoaded(false);

    void loadConversation(
      conversationId
    ).finally(() => {
      if (!cancelled) {
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    conversationId,
    loadConversation
  ]);

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
    conversationTitle &&
    conversationTitle !==
      'New chat'
      ? conversationTitle
      : messages[0]
          ?.content
          ?.slice(0, 48) ||
        (loaded
          ? 'Conversation'
          : 'Loading…');

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
