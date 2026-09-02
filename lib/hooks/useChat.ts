'use client';

import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction
} from 'react';

import type {
  Attachment,
  ChatMessage,
  Source
} from '@/lib/types/chat';

const SOURCES_MARKER =
  '__SOURCES__';

function visibleText(
  buffer: string
): string {
  const index =
    buffer.indexOf(
      SOURCES_MARKER
    );

  return index === -1
    ? buffer
    : buffer.slice(
        0,
        index
      );
}

function extractSourcesFrame(
  buffer: string
): { sources?: Source[] } {
  const index =
    buffer.indexOf(
      SOURCES_MARKER
    );

  if (index === -1) {
    return {};
  }

  try {
    const sources =
      JSON.parse(
        buffer.slice(
          index +
            SOURCES_MARKER.length
        )
      ) as Source[];

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
  "_Meridian isn't connected to a live model yet, so this is a local demo reply. " +
  'Set `AI_PROVIDER_KEY` and `DATABASE_URL` in `.env.local` to get real responses — see the README._\n\n' +
  'Once connected, this same UI streams real tokens from your configured provider, with your ' +
  'conversation saved to Postgres and picked up again next time you open it.';

async function streamDemoFallback(
  assistantId: string,
  setMessages: Dispatch<
    SetStateAction<ChatMessage[]>
  >,
  signal: AbortSignal
) {
  const words =
    DEMO_FALLBACK_NOTICE.split(
      ' '
    );

  for (
    let index = 1;
    index <= words.length;
    index += 1
  ) {
    if (signal.aborted) {
      return;
    }

    await new Promise(
      (resolve) =>
        setTimeout(
          resolve,
          22
        )
    );

    const partial =
      words
        .slice(
          0,
          index
        )
        .join(' ');

    setMessages(
      (previous) =>
        previous.map(
          (message) =>
            message.id ===
            assistantId
              ? {
                  ...message,
                  content:
                    partial
                }
              : message
        )
    );
  }
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

  const abortRef =
    useRef<AbortController | null>(
      null
    );

  /*
   * ---------------------------------------------------------
   * Load existing conversation
   * ---------------------------------------------------------
   */

  const loadConversation =
    useCallback(
      async (id: string) => {
        const response =
          await fetch(
            `/api/conversations/${id}`
          );

        if (!response.ok) {
          return;
        }

        const data =
          await response.json();

        setConversationId(id);

        setMessages(
          (
            data.messages as {
              id: string;
              role: string;
              content: string;
              createdAt: string;
            }[]
          )
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
                  message.createdAt
              })
            )
        );
      },
      []
    );

  /*
   * ---------------------------------------------------------
   * Run assistant turn
   * ---------------------------------------------------------
   */

  const runAssistantTurn =
    useCallback(
      async (
        userText: string,
        assistantId: string,
        model: string,
        fileIds?: string[],
        webSearchEnabled?: boolean,
        deepResearchEnabled?: boolean
      ) => {
        const controller =
          new AbortController();

        abortRef.current =
          controller;

        setIsGenerating(true);

        try {
          /*
           * IMPORTANT:
           * Deep Research is now sent to the
           * real backend contract.
           */
          const requestBody = {
            message: userText,
            model,
            conversationId,
            fileIds,
            webSearchEnabled,
            deepResearchEnabled
          };

          const response =
            await fetch(
              '/api/chat',
              {
                method: 'POST',
                headers: {
                  'Content-Type':
                    'application/json'
                },
                body: JSON.stringify(
                  requestBody
                ),
                signal:
                  controller.signal
              }
            );

          if (
            response.status ===
            503
          ) {
            await streamDemoFallback(
              assistantId,
              setMessages,
              controller.signal
            );

            return;
          }

          if (!response.ok) {
            let errorMessage =
              `Request failed with status ${response.status}`;

            try {
              const errorData =
                await response.json();

              if (
                typeof errorData?.error ===
                'string'
              ) {
                errorMessage =
                  errorData.error;
              }
            } catch {
              // Keep fallback error.
            }

            throw new Error(
              errorMessage
            );
          }

          if (!response.body) {
            throw new Error(
              'No response body'
            );
          }

          const reader =
            response.body.getReader();

          const decoder =
            new TextDecoder();

          let buffer = '';

          let metaConsumed =
            false;

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
             * -------------------------------------------------
             * Metadata frame
             * -------------------------------------------------
             */

            if (!metaConsumed) {
              const newlineIndex =
                buffer.indexOf(
                  '\n'
                );

              if (
                newlineIndex !==
                  -1 &&
                buffer.startsWith(
                  '__META__'
                )
              ) {
                const metaLine =
                  buffer.slice(
                    '__META__'.length,
                    newlineIndex
                  );

                buffer =
                  buffer.slice(
                    newlineIndex + 1
                  );

                metaConsumed =
                  true;

                try {
                  const meta =
                    JSON.parse(
                      metaLine
                    );

                  if (
                    meta.conversationId
                  ) {
                    setConversationId(
                      meta.conversationId
                    );
                  }
                } catch {
                  /*
                   * Ignore malformed
                   * metadata frames.
                   */
                }
              } else if (
                newlineIndex ===
                -1
              ) {
                continue;
              }
            }

            /*
             * -------------------------------------------------
             * Streaming assistant text
             * -------------------------------------------------
             */

            setMessages(
              (previous) =>
                previous.map(
                  (message) =>
                    message.id ===
                    assistantId
                      ? {
                          ...message,
                          content:
                            visibleText(
                              buffer
                            )
                        }
                      : message
                )
            );
          }

          /*
           * -------------------------------------------------
           * Sources frame
           * -------------------------------------------------
           */

          const {
            sources
          } =
            extractSourcesFrame(
              buffer
            );

          if (sources) {
            setMessages(
              (previous) =>
                previous.map(
                  (message) =>
                    message.id ===
                    assistantId
                      ? {
                          ...message,
                          sources
                        }
                      : message
                )
            );
          }
        } catch (error) {
          if (
            (error as Error)
              .name !==
            'AbortError'
          ) {
            const message =
              error instanceof Error
                ? error.message
                : 'Unknown error';

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
          }
        } finally {
          setMessages(
            (previous) =>
              previous.map(
                (message) =>
                  message.id ===
                  assistantId
                    ? {
                        ...message,
                        isStreaming:
                          false
                      }
                    : message
              )
          );

          setIsGenerating(
            false
          );

          abortRef.current =
            null;
        }
      },
      [conversationId]
    );

  /*
   * ---------------------------------------------------------
   * Send message
   * ---------------------------------------------------------
   *
   * Signature:
   *
   * text
   * model
   * fileIds
   * webSearchEnabled
   * attachments
   * deepResearchEnabled
   *
   * Keeping attachments before Deep Research
   * avoids breaking the existing attachment flow.
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

        if (!trimmed) {
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
          deepResearchEnabled
        );
      },
      [runAssistantTurn]
    );

  /*
   * ---------------------------------------------------------
   * Regenerate
   * ---------------------------------------------------------
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
        const index =
          messages.findIndex(
            (message) =>
              message.id ===
              messageId
          );

        if (index === -1) {
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
          deepResearchEnabled
        );
      },
      [messages, runAssistantTurn]
    );

  /*
   * ---------------------------------------------------------
   * Stop generation
   * ---------------------------------------------------------
   */

  const stop =
    useCallback(() => {
      abortRef.current?.abort();

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
   * ---------------------------------------------------------
   * Edit message
   * ---------------------------------------------------------
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

        if (!trimmed) {
          return;
        }

        setMessages(
          (previous) => {
            const index =
              previous.findIndex(
                (message) =>
                  message.id ===
                  messageId
              );

            if (index === -1) {
              return previous;
            }

            return previous.slice(
              0,
              index
            );
          }
        );

        sendMessage(
          trimmed,
          model,
          fileIds,
          webSearchEnabled,
          undefined,
          deepResearchEnabled
        );
      },
      [sendMessage]
    );

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
