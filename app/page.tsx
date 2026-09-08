'use client';

import {
  useEffect,
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

  const [
    startContext,
    setStartContext
  ] = useState<{
    projectName?: string;
    agentName?: string;
  } | null>(null);

  const {
    messages,
    isGenerating,
    sendMessage,
    regenerate,
    stop,
    editMessage,
    conversationId,
    conversationTitle,
    setChatContext
  } = useChat();

  /*
   * A "Start chat" button on the Projects or Agents page
   * links here with ?projectId=... or ?agentId=... — pick
   * that up once, lock it into the chat's context for the
   * (not-yet-created) conversation, and show a small label
   * so the person knows what they're chatting with/in.
   */
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const params =
      new URLSearchParams(
        window.location.search
      );

    const projectId =
      params.get('projectId') ||
      undefined;

    const agentId =
      params.get('agentId') ||
      undefined;

    if (!projectId && !agentId) {
      return;
    }

    setChatContext({
      projectId,
      agentId
    });

    (async () => {
      try {
        if (projectId) {
          const res = await fetch(
            `/api/projects/${projectId}`
          );

          if (res.ok) {
            const data =
              await res.json();

            setStartContext(
              (previous) => ({
                ...previous,
                projectName:
                  data?.project
                    ?.name
              })
            );
          }
        }

        if (agentId) {
          const res = await fetch(
            `/api/agents/${agentId}`
          );

          if (res.ok) {
            const data =
              await res.json();

            setStartContext(
              (previous) => ({
                ...previous,
                agentName:
                  data?.agent
                    ?.name
              })
            );
          }
        }
      } catch {
        // Non-critical — the chat still works even if the
        // label can't be fetched.
      }
    })();

    // Only read the query string once, on first load of a
    // brand-new chat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

        {messages.length ===
          0 &&
        (startContext?.projectName ||
          startContext?.agentName) ? (
          <div className="border-b border-black/10 bg-black/[0.03] px-4 py-2 text-xs text-black/60 dark:border-white/10 dark:bg-white/[0.04] dark:text-white/60">
            {startContext.agentName && (
              <span>
                Chatting with agent{' '}
                <strong>
                  {
                    startContext.agentName
                  }
                </strong>
              </span>
            )}
            {startContext.agentName &&
              startContext.projectName &&
              ' · '}
            {startContext.projectName && (
              <span>
                Project:{' '}
                <strong>
                  {
                    startContext.projectName
                  }
                </strong>
              </span>
            )}
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">
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
