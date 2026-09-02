'use client';

import {
  useEffect,
  useState
} from 'react';

import { useParams } from 'next/navigation';

import { AppShell } from '@/components/layout/AppShell';
import { ChatHeader } from '@/components/chat/ChatHeader';
import { MessageList } from '@/components/chat/MessageList';
import { ChatComposer } from '@/components/chat/ChatComposer';
import { useChat } from '@/lib/hooks/useChat';

import type { Attachment } from '@/lib/types/chat';

export default function ConversationPage() {
  const params =
    useParams<{ id: string }>();

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
  } = useChat(params.id);

  useEffect(() => {
    if (!params.id) return;

    loadConversation(
      params.id
    ).finally(() => {
      setLoaded(true);
    });

    // loadConversation is intentionally
    // called when route id changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

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
      : loaded
        ? 'Conversation'
        : 'Loading…';

  return (
    <AppShell>
      <ChatHeader title={title} />

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
          params.id
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
