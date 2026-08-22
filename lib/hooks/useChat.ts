'use client';

import { useCallback, useRef, useState } from 'react';
import type { ChatMessage, Source } from '@/lib/types/chat';

const SOURCES_MARKER = '__SOURCES__';

/** Strips the trailing __SOURCES__ frame so it's never shown as raw text mid-stream. */
function visibleText(buffer: string): string {
  const idx = buffer.indexOf(SOURCES_MARKER);
  return idx === -1 ? buffer : buffer.slice(0, idx);
}

function extractSourcesFrame(buffer: string): { sources?: Source[] } {
  const idx = buffer.indexOf(SOURCES_MARKER);
  if (idx === -1) return {};
  try {
    const sources = JSON.parse(buffer.slice(idx + SOURCES_MARKER.length)) as Source[];
    return { sources };
  } catch {
    return {};
  }
}

let idCounter = 0;
function nextId() {
  idCounter += 1;
  return `msg-${idCounter}-${Date.now()}`;
}

const DEMO_FALLBACK_NOTICE =
  '_Meridian isn\'t connected to a live model yet, so this is a local demo reply. ' +
  'Set `AI_PROVIDER_KEY` and `DATABASE_URL` in `.env.local` to get real responses — see the README._\n\n' +
  "Once connected, this same UI streams real tokens from your configured provider, with your " +
  'conversation saved to Postgres and picked up again next time you open it.';

async function streamDemoFallback(
  assistantId: string,
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>,
  signal: AbortSignal
) {
  const words = DEMO_FALLBACK_NOTICE.split(' ');
  for (let i = 1; i <= words.length; i++) {
    if (signal.aborted) return;
    await new Promise((r) => setTimeout(r, 22));
    const partial = words.slice(0, i).join(' ');
    setMessages((prev) => prev.map((m) => (m.id === assistantId ? { ...m, content: partial } : m)));
  }
}

export function useChat(initialConversationId?: string) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>(initialConversationId);
  const abortRef = useRef<AbortController | null>(null);
  const lastUserMessageRef = useRef<string>('');

  const loadConversation = useCallback(async (id: string) => {
    const res = await fetch(`/api/conversations/${id}`);
    if (!res.ok) return;
    const data = await res.json();
    setConversationId(id);
    setMessages(
      (data.messages as { id: string; role: string; content: string; createdAt: string }[])
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          id: m.id,
          role: m.role as ChatMessage['role'],
          content: m.content,
          createdAt: m.createdAt
        }))
    );
  }, []);

  const runAssistantTurn = useCallback(
    async (
      userText: string,
      assistantId: string,
      model: string,
      fileIds?: string[],
      webSearchEnabled?: boolean
    ) => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsGenerating(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: userText, model, conversationId, fileIds, webSearchEnabled }),
          signal: controller.signal
        });

        if (res.status === 503) {
          // Provider/DB not configured yet — fall back to a clearly labeled local demo
          // so the UI remains testable without credentials.
          await streamDemoFallback(assistantId, setMessages, controller.signal);
          return;
        }

        if (!res.body) throw new Error('No response body');

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let metaConsumed = false;

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });

          if (!metaConsumed) {
            const newlineIndex = buffer.indexOf('\n');
            if (newlineIndex !== -1 && buffer.startsWith('__META__')) {
              const metaLine = buffer.slice('__META__'.length, newlineIndex);
              buffer = buffer.slice(newlineIndex + 1);
              metaConsumed = true;
              try {
                const meta = JSON.parse(metaLine);
                if (meta.conversationId) setConversationId(meta.conversationId);
              } catch {
                // ignore malformed meta frame
              }
            } else if (newlineIndex === -1) {
              continue; // wait for the rest of the meta line
            }
          }

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: visibleText(buffer) } : m
            )
          );
        }

        const { sources } = extractSourcesFrame(buffer);
        if (sources) {
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, sources } : m))
          );
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: `_Something went wrong: ${(err as Error).message}_` }
                : m
            )
          );
        }
      } finally {
        setMessages((prev) =>
          prev.map((m) => (m.id === assistantId ? { ...m, isStreaming: false } : m))
        );
        setIsGenerating(false);
        abortRef.current = null;
      }
    },
    [conversationId]
  );

  const sendMessage = useCallback(
    (text: string, model: string, fileIds?: string[], webSearchEnabled?: boolean) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      lastUserMessageRef.current = trimmed;

      const userMessage: ChatMessage = {
        id: nextId(),
        role: 'user',
        content: trimmed,
        createdAt: new Date().toISOString()
      };
      const assistantId = nextId();
      const assistantMessage: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        isStreaming: true
      };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      void runAssistantTurn(trimmed, assistantId, model, fileIds, webSearchEnabled);
    },
    [runAssistantTurn]
  );

  const regenerate = useCallback(
    (messageId: string, model: string, fileIds?: string[], webSearchEnabled?: boolean) => {
      const index = messages.findIndex((m) => m.id === messageId);
      if (index === -1) return;
      const priorUser = [...messages.slice(0, index)].reverse().find((m) => m.role === 'user');
      if (!priorUser) return;

      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, content: '', sources: undefined, isStreaming: true } : m))
      );
      void runAssistantTurn(priorUser.content, messageId, model, fileIds, webSearchEnabled);
    },
    [messages, runAssistantTurn]
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setIsGenerating(false);
    setMessages((prev) => prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m)));
  }, []);

  const editMessage = useCallback((messageId: string, newContent: string, model: string, fileIds?: string[], webSearchEnabled?: boolean) => {
    setMessages((prev) => {
      const index = prev.findIndex((m) => m.id === messageId);
      if (index === -1) return prev;
      const truncated = prev.slice(0, index);
      return truncated;
    });
    sendMessage(newContent, model, fileIds, webSearchEnabled);
  }, [sendMessage]);

  return {
    messages,
    isGenerating,
    conversationId,
    sendMessage,
    regenerate,
    stop,
    editMessage,
    loadConversation
  };
}
