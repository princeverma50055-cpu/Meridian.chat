import { NextRequest } from 'next/server';

import {
  getAIProvider,
  type ChatTurn,
  type ContentPart
} from '@/lib/ai/provider';

import { resolveModel } from '@/lib/ai/models';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import {
  getEmbeddingsProvider
} from '@/lib/embeddings/provider';

import {
  searchSimilarChunks,
  getFilesByIds
} from '@/lib/db/files';

import {
  getStorageProvider
} from '@/lib/storage/provider';

import {
  performWebSearch
} from '@/lib/search/pipeline';

import type {
  WebSource
} from '@/lib/search/provider';

import {
  addMessage,
  createConversation,
  deriveTitle,
  getConversationMessages,
  renameConversation
} from '@/lib/db/conversations';

import {
  getRequestId
} from '@/lib/security/request';

import {
  securityHeaders
} from '@/lib/security/headers';

export const runtime = 'nodejs';

interface ChatRequestBody {
  message: string;
  model: string;
  conversationId?: string;
  fileIds?: string[];
  webSearchEnabled?: boolean;
  deepResearchEnabled?: boolean;
}

const MAX_MESSAGE_LENGTH = 50_000;
const MAX_FILE_IDS = 20;

function jsonError(
  message: string,
  status: number,
  requestId?: string
) {
  return new Response(
    JSON.stringify({
      error: message,
      requestId
    }),
    {
      status,
      headers: {
        'Content-Type':
          'application/json; charset=utf-8',
        ...securityHeaders(requestId)
      }
    }
  );
}

function normalizeFileIds(
  value: unknown
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return [
    ...new Set(
      value
        .filter(
          (id): id is string =>
            typeof id === 'string'
        )
        .map((id) =>
          id.trim()
        )
        .filter(Boolean)
    )
  ];
}

export async function POST(
  req: NextRequest
) {
  const requestId =
    getRequestId(req);

  /*
   * ---------------------------------------------------------
   * 1. Parse and validate request
   * ---------------------------------------------------------
   */

  const body =
    (await req
      .json()
      .catch(() => null)) as
      | ChatRequestBody
      | null;

  if (
    !body ||
    typeof body.message !==
      'string' ||
    typeof body.model !==
      'string'
  ) {
    return jsonError(
      'Expected { message: string, model: string, conversationId?: string }',
      400,
      requestId
    );
  }

  const message =
    body.message
      .replace(/\u0000/g, '')
      .trim();

  if (!message) {
    return jsonError(
      'Message cannot be empty.',
      400,
      requestId
    );
  }

  if (
    message.length >
    MAX_MESSAGE_LENGTH
  ) {
    return jsonError(
      `Message is too long. Maximum ${MAX_MESSAGE_LENGTH.toLocaleString()} characters allowed.`,
      413,
      requestId
    );
  }

  const fileIds =
    normalizeFileIds(
      body.fileIds
    );

  if (
    fileIds.length >
    MAX_FILE_IDS
  ) {
    return jsonError(
      `Maximum ${MAX_FILE_IDS} files can be attached to one message.`,
      400,
      requestId
    );
  }

  /*
   * ---------------------------------------------------------
   * 2. Authentication
   * ---------------------------------------------------------
   */

  let userId: string;

  try {
    userId =
      await getCurrentUserId();
  } catch (err) {
    return jsonError(
      'Authentication required.',
      err instanceof
        UnauthorizedError
        ? 401
        : 500,
      requestId
    );
  }

  /*
   * ---------------------------------------------------------
   * 3. AI provider + model validation
   * ---------------------------------------------------------
   */

  let provider;
  let resolvedModel: string;

  try {
    provider =
      getAIProvider();

    resolvedModel =
      resolveModel(
        body.model
      );
  } catch (err) {
    return jsonError(
      err instanceof Error
        ? err.message
        : 'AI provider is not configured.',
      503,
      requestId
    );
  }

  /*
   * ---------------------------------------------------------
   * 4. Conversation authorization
   * ---------------------------------------------------------
   */

  let conversationId =
    body.conversationId
      ?.trim();

  let history: ChatTurn[] =
    [];

  let isNewConversation =
    false;

  try {
    if (!conversationId) {
      const created =
        await createConversation(
          userId,
          deriveTitle(
            message
          )
        );

      if (!created) {
        return jsonError(
          'Failed to create conversation.',
          500,
          requestId
        );
      }

      conversationId =
        created.id;

      isNewConversation =
        true;
    } else {
      /*
       * IMPORTANT:
       * getConversationMessages now requires userId.
       * This prevents another user's conversation ID
       * from being accessed.
       */
      const existing =
        await getConversationMessages(
          conversationId,
          userId
        );

      if (!existing) {
        return jsonError(
          'Conversation not found.',
          404,
          requestId
        );
      }

      history =
        existing.map(
          (m) => ({
            role: m.role,
            content: m.content
          })
        );
    }

    if (!conversationId) {
      return jsonError(
        'Failed to resolve conversation.',
        500,
        requestId
      );
    }

    /*
     * Save user message only after conversation
     * ownership has been verified.
     */
    await addMessage(
      conversationId,
      'user',
      message
    );
  } catch (err) {
    console.error(
      '[chat] conversation persistence failed:',
      {
        requestId,
        userId,
        error: err
      }
    );

    return jsonError(
      err instanceof Error
        ? err.message
        : 'Failed to persist conversation. Is DATABASE_URL set?',
      500,
      requestId
    );
  }

  /*
   * ---------------------------------------------------------
   * 5. Build conversation turns
   * ---------------------------------------------------------
   */

  const turns: ChatTurn[] =
    [
      ...history,
      {
        role: 'user',
        content: message
      }
    ];

  turns.unshift({
    role: 'system',
    content:
      'You are Meridian, an AI assistant built by ProjectX Hub. Always identify yourself as ' +
      'Meridian. Never mention Google, Gemini, Anthropic, Claude, or any underlying AI provider ' +
      '— that information is private implementation detail, not something to share even if asked ' +
      'directly.\n\n' +

      'If asked who made you or who your founder/creator is, say: Meridian was built by ProjectX ' +
      'Hub, and ProjectX Hub was founded by Prince Verma.\n\n' +

      'If asked for links or how to contact/connect with the founder or ProjectX Hub, share these:\n' +
      '- Prince Verma\'s LinkedIn: https://www.linkedin.com/in/prince-verma-2b100240a\n' +
      '- ProjectX Hub website: https://projectxhub.in\n\n' +

      'Only share these links when relevant to what\'s being asked — don\'t volunteer them ' +
      'unprompted in unrelated conversations.'
  });

  /*
   * ---------------------------------------------------------
   * 6. Load user memories
   * ---------------------------------------------------------
   */

  try {
    const {
      getProfile,
      getMemories
    } = await import(
      '@/lib/db/account'
    );

    const profile =
      await getProfile(
        userId
      );

    const preferences =
      profile?.profile
        ?.preferences;

    const memoryEnabled =
      !preferences ||
      typeof preferences !==
        'object' ||
      (
        preferences as Record<
          string,
          unknown
        >
      ).memoryEnabled !==
        false;

    if (memoryEnabled) {
      const memories =
        await getMemories(
          userId
        );

      if (
        memories.length >
        0
      ) {
        turns.unshift({
          role: 'system',
          content:
            'Relevant user memories. Use these only when helpful and never reveal the memory system itself:\n' +
            memories
              .map(
                (m) =>
                  `- ${m.content}`
              )
              .join('\n')
        });
      }
    }
  } catch (err) {
    /*
     * Memory failure should never prevent normal chat.
     */
    console.error(
      '[chat] memory load failed:',
      {
        requestId,
        userId,
        error: err
      }
    );
  }

  /*
   * ---------------------------------------------------------
   * 7. Web search / deep research
   * ---------------------------------------------------------
   */

  let webSources: WebSource[] =
    [];

  if (
    body.webSearchEnabled ||
    body.deepResearchEnabled
  ) {
    try {
      webSources =
        await performWebSearch(
          message,
          provider,
          resolvedModel,
          body.deepResearchEnabled ===
            true
        );

      if (
        webSources.length >
        0
      ) {
        const context =
          webSources
            .map(
              (source) =>
                `[${source.id}] ${source.title} (${source.domain})\n${source.snippet}\nURL: ${source.url}`
            )
            .join(
              '\n\n'
            );

        turns.unshift({
          role: 'system',
          content:
            'Web search results for the user\'s question are below. Cite sources inline using ' +
            '[1], [2], etc. matching the numbers below. Only cite a source for claims it actually ' +
            'supports — never fabricate a citation or invent a source that isn\'t listed here. If ' +
            'the results don\'t answer the question, say so.\n\n' +
            context
        });
      } else {
        turns.unshift({
          role: 'system',
          content:
            'Web search returned no results for this question. Say so rather than guessing.'
        });
      }
    } catch (err) {
      console.error(
        '[chat] web search failed:',
        {
          requestId,
          userId,
          error: err
        }
      );

      turns.unshift({
        role: 'system',
        content:
          `Note: web search failed (${err instanceof Error ? err.message : 'unknown error'}). Tell the user search wasn't available rather than answering as if it succeeded.`
      });
    }
  }

  /*
   * ---------------------------------------------------------
   * 8. File authorization + RAG + image vision
   * ---------------------------------------------------------
   */

  if (
    fileIds.length >
    0
  ) {
    try {
      /*
       * SECURITY:
       * getFilesByIds now filters by userId at the
       * database level.
       */
      const allFileRecords =
        await getFilesByIds(
          fileIds,
          userId
        );

      /*
       * A requested file that wasn't returned means
       * it either doesn't exist or belongs to another user.
       */
      if (
        allFileRecords.length !==
        fileIds.length
      ) {
        return jsonError(
          'One or more files are not accessible to this account.',
          403,
          requestId
        );
      }

      /*
       * A file attached to another conversation must not
       * automatically become usable in this conversation.
       */
      const fileRecords =
        allFileRecords.filter(
          (file) =>
            !file.conversationId ||
            file.conversationId ===
              conversationId
        );

      if (
        fileRecords.length !==
        fileIds.length
      ) {
        return jsonError(
          'One or more files are not accessible from this conversation.',
          403,
          requestId
        );
      }

      /*
       * -----------------------------------------------------
       * Images
       * -----------------------------------------------------
       */

      const imageFiles =
        fileRecords.filter(
          (file) =>
            file.mimeType.startsWith(
              'image/'
            )
        );

      /*
       * -----------------------------------------------------
       * Text files
       * -----------------------------------------------------
       */

      const textFileIds =
        fileRecords
          .filter(
            (file) =>
              !file.mimeType.startsWith(
                'image/'
              )
          )
          .map(
            (file) =>
              file.id
          );

      /*
       * Images are loaded from private storage and passed
       * directly to the AI provider as vision input.
       */
      if (
        imageFiles.length >
        0
      ) {
        const storage =
          getStorageProvider();

        const imageParts:
          ContentPart[] =
          [];

        for (
          const image of imageFiles
        ) {
          try {
            const buffer =
              await storage.read(
                image.storagePath
              );

            imageParts.push({
              type: 'image',
              mimeType:
                image.mimeType,
              data:
                buffer.toString(
                  'base64'
                )
            });
          } catch (err) {
            console.error(
              '[chat] failed to read image for vision:',
              {
                requestId,
                userId,
                fileId:
                  image.id,
                error: err
              }
            );
          }
        }

        if (
          imageParts.length >
          0
        ) {
          const lastTurn =
            turns[
              turns.length - 1
            ];

          if (
            lastTurn &&
            lastTurn.role ===
              'user'
          ) {
            const textContent =
              typeof lastTurn.content ===
              'string'
                ? lastTurn.content
                : message;

            lastTurn.content = [
              {
                type: 'text',
                text: textContent
              },
              ...imageParts
            ];
          }
        }
      }

      /*
       * -----------------------------------------------------
       * Text-file RAG
       * -----------------------------------------------------
       */

      if (
        textFileIds.length >
        0
      ) {
        const embeddingsProvider =
          getEmbeddingsProvider();

        const [
          queryEmbedding
        ] =
          await embeddingsProvider.embed(
            [message]
          );

        if (
          !queryEmbedding
        ) {
          throw new Error(
            'Failed to generate embedding for the message.'
          );
        }

        /*
         * SECURITY:
         * userId is passed into searchSimilarChunks.
         * This prevents vector search from returning
         * another user's file chunks.
         */
        const matches =
          await searchSimilarChunks(
            textFileIds,
            queryEmbedding,
            6,
            userId
          );

        if (
          matches.length >
          0
        ) {
          const nameById =
            new Map(
              fileRecords.map(
                (file) => [
                  file.id,
                  file.fileName
                ]
              )
            );

          const context =
            matches
              .map(
                (match) =>
                  `From "${nameById.get(match.file_id) ?? 'file'}":\n${match.content}`
              )
              .join(
                '\n\n---\n\n'
              );

          turns.unshift({
            role: 'system',
            content:
              'The user has attached file(s). Use the following retrieved excerpts to answer ' +
              'if relevant, and cite which file each fact comes from. If the excerpts don\'t ' +
              'contain the answer, say so rather than guessing.\n\n' +
              context
          });
        }
      }
    } catch (err) {
      console.error(
        '[chat] file retrieval failed:',
        {
          requestId,
          userId,
          error: err
        }
      );

      /*
       * Do not expose internal storage/database
       * details to the client/model.
       */
      turns.unshift({
        role: 'system',
        content:
          'Note: file retrieval was unavailable for this request. Answer without file context and clearly mention that the attached-file context could not be loaded.'
      });
    }
  }

  /*
   * ---------------------------------------------------------
   * 9. Streaming AI response
   * ---------------------------------------------------------
   */

  const encoder =
    new TextEncoder();

  const finalConversationId =
    conversationId as string;

  const stream =
    new ReadableStream({
      async start(
        controller
      ) {
        /*
         * Send metadata first.
         */
        controller.enqueue(
          encoder.encode(
            `__META__${JSON.stringify(
              {
                conversationId:
                  finalConversationId,
                requestId
              }
            )}\n`
          )
        );

        let fullText =
          '';

        try {
          const generator =
            provider.stream({
              messages:
                turns,
              model:
                resolvedModel
            });

          for await (
            const chunk of generator
          ) {
            fullText += chunk;

            controller.enqueue(
              encoder.encode(
                chunk
              )
            );
          }

          /*
           * Send web sources after the generated answer.
           */
          if (
            webSources.length >
            0
          ) {
            controller.enqueue(
              encoder.encode(
                `\n__SOURCES__${JSON.stringify(
                  webSources
                )}`
              )
            );
          }

          /*
           * Persist assistant response.
           */
          await addMessage(
            finalConversationId,
            'assistant',
            fullText,
            resolvedModel
          );

          /*
           * The conversation was already created with a title.
           * Rename again only for compatibility with the
           * existing application behavior.
           */
          if (
            isNewConversation
          ) {
            await renameConversation(
              userId,
              finalConversationId,
              deriveTitle(
                message
              )
            );
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'Generation failed';

          console.error(
            '[chat] generation failed:',
            {
              requestId,
              userId,
              conversationId:
                finalConversationId,
              error: err
            }
          );

          /*
           * Never expose provider/internal error details
           * directly to the client.
           */
          controller.enqueue(
            encoder.encode(
              `\n[error] Unable to generate a response. Request ID: ${requestId}`
            )
          );

          /*
           * Preserve partial assistant output if generation
           * failed after some content was streamed.
           */
          if (
            fullText.trim()
          ) {
            await addMessage(
              finalConversationId,
              'assistant',
              fullText,
              resolvedModel
            ).catch(
              (saveError) => {
                console.error(
                  '[chat] failed to save partial response:',
                  {
                    requestId,
                    userId,
                    error:
                      saveError
                  }
                );
              }
            );
          }
        } finally {
          controller.close();
        }
      }
    });

  /*
   * ---------------------------------------------------------
   * 10. Secure streaming response
   * ---------------------------------------------------------
   */

  return new Response(
    stream,
    {
      status: 200,
      headers: {
        'Content-Type':
          'text/plain; charset=utf-8',

        'Cache-Control':
          'no-cache, no-transform',

        'X-Accel-Buffering':
          'no',

        ...securityHeaders(
          requestId
        )
      }
    }
  );
}
