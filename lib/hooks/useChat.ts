'use client';

import {
  useCallback,
  useRef,
  useState
} from 'react';

import type {
  Attachment,
  ChatMessage,
  Source
} from '@/lib/types/chat';

const SOURCES_MARKER =
  '__SOURCES__';

const META_MARKER =
  '__META__';

function visibleText(
  buffer: string
): string {
  const sourceIndex =
    buffer.indexOf(
      SOURCES_MARKER
    );

  if (
    sourceIndex !== -1
  ) {
    return buffer.slice(
      0,
      sourceIndex
    );
  }

  return buffer;
}

function extractSourcesFrame(
  buffer: string
): {
  sources?: Source[];
} {
  const idx =
    buffer.indexOf(
      SOURCES_MARKER
    );

  if (idx === -1) {
    return {};
  }

  try {
    const sources =
      JSON.parse(
        buffer.slice(
          idx +
            SOURCES_MARKER.length
        )
      ) as Source[];

    return {
      sources
    };
  } catch {
    return {};
  }
}

function getErrorMessage(
  data: unknown,
  fallback: string
): string {
  if (
    data &&
    typeof data === 'object'
  ) {
    const record =
      data as Record<
        string,
        unknown
      >;

    if (
      typeof record.message ===
      'string'
    ) {
      return record.message;
    }

    if (
      typeof record.error ===
      'string'
    ) {
      return record.error;
    }
  }

  return fallback;
}

function notifyConversationChanged() {
  if (
    typeof window ===
    'undefined'
  ) {
    return;
  }

  window.dispatchEvent(
    new Event(
      'meridian:conversations-changed'
    )
  );
}

let idCounter = 0;

function nextId() {
  idCounter += 1;

  return `msg-${idCounter}-${Date.now()}`;
}

export function useChat(
  initialConversationId?: string
) {
  const [
    messages,
    setMessages
  ] = useState<ChatMessage[]>(
    []
  );

  const [
    isGenerating,
    setIsGenerating
  ] = useState(false);

  const [
    conversationId,
    setConversationId
  ] = useState<
    string | undefined
  >(initialConversationId);

  const [
    conversationTitle,
    setConversationTitle
  ] = useState(
    'New chat'
  );

  const [
    authError,
    setAuthError
  ] = useState<
    string | null
  >(null);

  const abortRef =
    useRef<AbortController | null>(
      null
    );

  const mountedRef =
    useRef(true);

  /*
   * -------------------------------------------------------
   * Load existing conversation
   * -------------------------------------------------------
   */
  const loadConversation =
    useCallback(
      async (id: string) => {
        if (!id) {
          return;
        }

        try {
          setAuthError(null);

          const response =
            await fetch(
              `/api/conversations/${id}`,
              {
                method: 'GET',
                cache: 'no-store',
                credentials:
                  'include'
              }
            );

          if (
            response.status ===
            401
          ) {
            setAuthError(
              'Your session has expired. Please sign in again.'
            );

            if (
              typeof window !==
              'undefined'
            ) {
              window.location.href =
                '/login';
            }

            return;
          }

          if (
            response.status ===
            404
          ) {
            setMessages([]);
            setConversationId(
              undefined
            );
            setConversationTitle(
              'Conversation'
            );
            return;
          }

          if (!response.ok) {
            throw new Error(
              'Failed to load conversation.'
            );
          }

          const data =
            (await response.json()) as {
              conversation?: {
                id: string;
                title?: string;
              };
              messages?: Array<{
                id: string;
                role: string;
                content: string;
                createdAt:
                  | string
                  | Date;
              }>;
            };

          if (
            !mountedRef.current
          ) {
            return;
          }

          setConversationId(
            data.conversation?.id ||
              id
          );

          setConversationTitle(
            data.conversation?.title?.trim() ||
              'Conversation'
          );

          const loadedMessages =
            Array.isArray(
              data.messages
            )
              ? data.messages
              : [];

          setMessages(
            loadedMessages
              .filter(
                (message) =>
                  message.role !==
                  'system'
              )
              .map(
                (message) => ({
                  id: message.id,
                  role:
                    message.role as ChatMessage['role'],
                  content:
                    message.content,
                  createdAt:
                    new Date(
                      message.createdAt
                    ).toISOString()
                })
              )
          );
        } catch (error) {
          console.error(
            '[chat] Load conversation failed:',
            error
          );

          if (
            mountedRef.current
          ) {
            setAuthError(
              error instanceof
                Error
                ? error.message
                : 'Failed to load conversation.'
            );
          }
        }
      },
      []
    );

  /*
   * -------------------------------------------------------
   * Assistant streaming
   * -------------------------------------------------------
   */
  const runAssistantTurn =
    useCallback(
      async (
        userText: string,
        assistantId: string,
        model: string,
        fileIds?: string[],
        webSearchEnabled?: boolean,
        deepResearchEnabled?: boolean,
        targetConversationId?: string
      ) => {
        const controller =
          new AbortController();

        abortRef.current =
          controller;

        setIsGenerating(
          true
        );

        setAuthError(null);

        try {
          const response =
            await fetch(
              '/api/chat',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json'
                },
                credentials:
                  'include',
                body: JSON.stringify({
                  message:
                    userText,
                  model,
                  conversationId:
                    targetConversationId,
                  fileIds,
                  webSearchEnabled,
                  deepResearchEnabled
                }),
                signal:
                  controller.signal
              }
            );

          if (
            response.status ===
            401
          ) {
            let data:
              unknown = null;

            try {
              data =
                await response.json();
            } catch {
              // ignore
            }

            const message =
              getErrorMessage(
                data,
                'Authentication required. Please sign in again.'
              );

            setAuthError(
              message
            );

            setMessages(
              (previous) =>
                previous.map(
                  (item) =>
                    item.id ===
                    assistantId
                      ? {
                          ...item,
                          content: `_${message}_`,
                          isStreaming:
                            false
                        }
                      : item
                )
            );

            if (
              typeof window !==
              'undefined'
            ) {
              window.location.href =
                '/login';
            }

            return;
          }

          if (!response.ok) {
            let data:
              unknown = null;

            try {
              data =
                await response.json();
            } catch {
              // ignore
            }

            throw new Error(
              getErrorMessage(
                data,
                `Request failed with status ${response.status}.`
              )
            );
          }

          if (!response.body) {
            throw new Error(
              'No response body received.'
            );
          }

          const reader =
            response.body.getReader();

          const decoder =
            new TextDecoder();

          let buffer = '';

          let metaConsumed =
            false;

          let resolvedConversationId =
            targetConversationId;

          while (true) {
            const {
              value,
              done
            } =
              await reader.read();

            if (done) {
              break;
            }

            buffer +=
              decoder.decode(
                value,
                {
                  stream: true
                }
              );

            /*
             * The API sends:
             *
             * __META__{...}\n
             * tokens...
             *
             */
            if (
              !metaConsumed
            ) {
              const newlineIndex =
                buffer.indexOf(
                  '\n'
                );

              if (
                buffer.startsWith(
                  META_MARKER
                ) &&
                newlineIndex !==
                  -1
              ) {
                const metaLine =
                  buffer.slice(
                    META_MARKER.length,
                    newlineIndex
                  );

                buffer =
                  buffer.slice(
                    newlineIndex +
                      1
                  );

                metaConsumed =
                  true;

                try {
                  const meta =
                    JSON.parse(
                      metaLine
                    ) as {
                      conversationId?: string;
                    };

                  if (
                    meta.conversationId
                  ) {
                    resolvedConversationId =
                      meta.conversationId;

                    setConversationId(
                      meta.conversationId
                    );
                  }
                } catch {
                  console.warn(
                    '[chat] Invalid metadata frame.'
                  );
                }
              }
            }

            const text =
              visibleText(
                buffer
              );

            setMessages(
              (previous) =>
                previous.map(
                  (item) =>
                    item.id ===
                    assistantId
                      ? {
                          ...item,
                          content:
                            text
                        }
                      : item
                )
            );
          }

          const finalSources =
            extractSourcesFrame(
              buffer
            );

          if (
            finalSources.sources
          ) {
            setMessages(
              (previous) =>
                previous.map(
                  (item) =>
                    item.id ===
                    assistantId
                      ? {
                          ...item,
                          sources:
                            finalSources.sources
                        }
                      : item
                )
            );
          }

          if (
            resolvedConversationId
          ) {
            setConversationId(
              resolvedConversationId
            );

            if (
              !targetConversationId
            ) {
              const firstLine =
                userText
                  .trim()
                  .replace(
                    /\s+/g,
                    ' '
                  );

              setConversationTitle(
                firstLine.length >
                  48
                  ? `${firstLine.slice(
                      0,
                      48
                    )}…`
                  : firstLine ||
                      'New chat'
              );
            }
          }

          notifyConversationChanged();
        } catch (error) {
          if (
            error instanceof
              Error &&
            error.name ===
              'AbortError'
          ) {
            return;
          }

          console.error(
            '[chat] Assistant turn failed:',
            error
          );

          const message =
            error instanceof
            Error
              ? error.message
              : 'Unable to generate a response.';

          setMessages(
            (previous) =>
              previous.map(
                (item) =>
                  item.id ===
                  assistantId
                    ? {
                        ...item,
                        content: `_Something went wrong: ${message}_`
                      }
                    : item
              )
          );
        } finally {
          if (
            mountedRef.current
          ) {
            setMessages(
              (previous) =>
                previous.map(
                  (item) =>
                    item.id ===
                    assistantId
                      ? {
                          ...item,
                          isStreaming:
                            false
                        }
                      : item
                )
            );

            setIsGenerating(
              false
            );
          }

          abortRef.current =
            null;
        }
      },
      []
    );

  /*
   * -------------------------------------------------------
   * Send message
   * -------------------------------------------------------
   */
  const sendMessage =
    useCallback(
      (
        text: string,
        model: string,
        fileIds?: string[],
        webSearchEnabled?: boolean,
        attachments?: Attachment[],
        deepResearchEnabled?: boolean
      ) => {
        const trimmed =
          text.trim();

        if (
          !trimmed ||
          isGenerating
        ) {
          return;
        }

        const userMessage: ChatMessage =
          {
            id: nextId(),
            role: 'user',
            content: trimmed,
            createdAt:
              new Date().toISOString(),
            attachments:
              attachments &&
              attachments.length >
                0
                ? attachments
                : undefined
          };

        const assistantId =
          nextId();

        const assistantMessage: ChatMessage =
          {
            id: assistantId,
            role: 'assistant',
            content: '',
            createdAt:
              new Date().toISOString(),
            isStreaming: true
          };

        const targetConversationId =
          conversationId;

        setMessages(
          (previous) => [
            ...previous,
            userMessage,
            assistantMessage
          ]
        );

        void runAssistantTurn(
          trimmed,
          assistantId,
          model,
          fileIds,
          webSearchEnabled,
          deepResearchEnabled,
          targetConversationId
        );
      },
      [
        conversationId,
        isGenerating,
        runAssistantTurn
      ]
    );

  /*
   * -------------------------------------------------------
   * Regenerate
   * -------------------------------------------------------
   */
  const regenerate =
    useCallback(
      (
        messageId: string,
        model: string,
        fileIds?: string[],
        webSearchEnabled?: boolean,
        deepResearchEnabled?: boolean
      ) => {
        if (
          isGenerating
        ) {
          return;
        }

        const index =
          messages.findIndex(
            (message) =>
              message.id ===
              messageId
          );

        if (
          index === -1
        ) {
          return;
        }

        const priorUser =
          [
            ...messages.slice(
              0,
              index
            )
          ]
            .reverse()
            .find(
              (message) =>
                message.role ===
                'user'
            );

        if (!priorUser) {
          return;
        }

        setMessages(
          (previous) =>
            previous.map(
              (message) =>
                message.id ===
                messageId
                  ? {
                      ...message,
                      content: '',
                      sources:
                        undefined,
                      isStreaming:
                        true
                    }
                  : message
            )
        );

        void runAssistantTurn(
          priorUser.content,
          messageId,
          model,
          fileIds,
          webSearchEnabled,
          deepResearchEnabled,
          conversationId
        );
      },
      [
        conversationId,
        isGenerating,
        messages,
        runAssistantTurn
      ]
    );

  /*
   * -------------------------------------------------------
   * Stop generation
   * -------------------------------------------------------
   */
  const stop =
    useCallback(() => {
      abortRef.current?.abort();

      abortRef.current =
        null;

      setIsGenerating(
        false
      );

      setMessages(
        (previous) =>
          previous.map(
            (message) =>
              message.isStreaming
                ? {
                    ...message,
                    isStreaming:
                      false
                  }
                : message
          )
      );
    }, []);

  /*
   * -------------------------------------------------------
   * Edit user message
   * -------------------------------------------------------
   */
  const editMessage =
    useCallback(
      (
        messageId: string,
        newContent: string,
        model: string,
        fileIds?: string[],
        webSearchEnabled?: boolean,
        deepResearchEnabled?: boolean
      ) => {
        const trimmed =
          newContent.trim();

        if (
          !trimmed ||
          isGenerating
        ) {
          return;
        }

        const index =
          messages.findIndex(
            (message) =>
              message.id ===
              messageId
          );

        if (
          index === -1
        ) {
          return;
        }

        const newAssistantId =
          nextId();

        const userMessageId =
          nextId();

        const editedUserMessage:
          ChatMessage = {
            id: userMessageId,
            role: 'user',
            content: trimmed,
            createdAt:
              new Date().toISOString()
          };

        const assistantMessage:
          ChatMessage = {
            id: newAssistantId,
            role: 'assistant',
            content: '',
            createdAt:
              new Date().toISOString(),
            isStreaming: true
          };

        setMessages(
          (previous) => [
            ...previous.slice(
              0,
              index
            ),
            editedUserMessage,
            assistantMessage
          ]
        );

        void runAssistantTurn(
          trimmed,
          newAssistantId,
          model,
          fileIds,
          webSearchEnabled,
          deepResearchEnabled,
          conversationId
        );
      },
      [
        conversationId,
        isGenerating,
        messages,
        runAssistantTurn
      ]
    );

  /*
   * Cleanup
   */
  useState(() => {
    return undefined;
  });

  return {
    messages,
    isGenerating,
    conversationId,
    conversationTitle,
    authError,
    sendMessage,
    regenerate,
    stop,
    editMessage,
    loadConversation
  };
}
