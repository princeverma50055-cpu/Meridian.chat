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
import { getEmbeddingsProvider } from '@/lib/embeddings/provider';
import {
  searchSimilarChunks,
  getFilesByIds
} from '@/lib/db/files';
import { getStorageProvider } from '@/lib/storage/provider';
import { performWebSearch } from '@/lib/search/pipeline';
import type { WebSource } from '@/lib/search/provider';
import {
  addMessage,
  createConversation,
  deriveTitle,
  getConversationMessages,
  renameConversation
} from '@/lib/db/conversations';

export const runtime = 'nodejs';

interface ChatRequestBody {
  message: string;
  model: string;
  conversationId?: string;
  fileIds?: string[];
  webSearchEnabled?: boolean;
  deepResearchEnabled?: boolean;
}

function jsonError(message: string, status: number) {
  return new Response(
    JSON.stringify({
      error: message
    }),
    {
      status,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}

function normalizeFileIds(fileIds: unknown) {
  if (!Array.isArray(fileIds)) {
    return [];
  }

  return [
    ...new Set(
      fileIds
        .filter(
          (id): id is string =>
            typeof id === 'string'
        )
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ];
}

export async function POST(req: NextRequest) {
  let body: ChatRequestBody | null = null;

  try {
    body = (await req.json()) as ChatRequestBody;
  } catch {
    return jsonError(
      'Invalid JSON request body.',
      400
    );
  }

  if (
    !body ||
    typeof body.message !== 'string' ||
    typeof body.model !== 'string'
  ) {
    return jsonError(
      'Expected { message: string, model: string, conversationId?: string }',
      400
    );
  }

  const message = body.message.trim();

  if (!message) {
    return jsonError(
      'Message cannot be empty.',
      400
    );
  }

  if (message.length > 50000) {
    return jsonError(
      'Message is too long. Maximum length is 50,000 characters.',
      400
    );
  }

  const model = body.model.trim();

  if (!model) {
    return jsonError(
      'Model is required.',
      400
    );
  }

  const fileIds = normalizeFileIds(
    body.fileIds
  );

  if (fileIds.length > 20) {
    return jsonError(
      'You can attach a maximum of 20 files per message.',
      400
    );
  }

  let provider;
  let resolvedModel: string;

  try {
    provider = getAIProvider();
    resolvedModel = resolveModel(model);
  } catch (err) {
    return jsonError(
      err instanceof Error
        ? err.message
        : 'AI provider is not configured.',
      503
    );
  }

  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (err) {
    return jsonError(
      'Authentication required.',
      err instanceof UnauthorizedError
        ? 401
        : 500
    );
  }

  let conversationId = body.conversationId?.trim();
  let history: ChatTurn[] = [];
  let isNewConversation = false;

  try {
    /*
     * Create a new conversation for this authenticated user.
     */
    if (!conversationId) {
      const created = await createConversation(
        userId,
        deriveTitle(message)
      );

      if (!created) {
        return jsonError(
          'Failed to create conversation.',
          500
        );
      }

      conversationId = created.id;
      isNewConversation = true;
    } else {
      /*
       * IMPORTANT:
       * getConversationMessages() now requires userId.
       *
       * Therefore a user cannot read another user's conversation simply
       * by supplying its UUID.
       */
      const existing =
        await getConversationMessages(
          conversationId,
          userId
        );

      if (!existing) {
        return jsonError(
          'Conversation not found.',
          404
        );
      }

      history = existing.map((m) => ({
        role: m.role,
        content: m.content
      }));
    }

    if (!conversationId) {
      return jsonError(
        'Failed to resolve conversation.',
        500
      );
    }

    await addMessage(
      conversationId,
      'user',
      message
    );
  } catch (err) {
    console.error(
      '[chat] conversation persistence failed:',
      err
    );

    return jsonError(
      err instanceof Error
        ? err.message
        : 'Failed to persist conversation.',
      500
    );
  }

  const turns: ChatTurn[] = [
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
   * User memory
   */
  try {
    const {
      getProfile,
      getMemories
    } = await import(
      '@/lib/db/account'
    );

    const profile =
      await getProfile(userId);

    if (
      profile?.profile?.preferences &&
      (
        profile.profile.preferences as {
          memoryEnabled?: boolean;
        }
      ).memoryEnabled !== false
    ) {
      const memories =
        await getMemories(userId);

      if (memories.length > 0) {
        turns.unshift({
          role: 'system',
          content:
            'Relevant user memories. Use these only when helpful and never reveal the memory system itself:\n' +
            memories
              .map(
                (memory) =>
                  `- ${memory.content}`
              )
              .join('\n')
        });
      }
    }
  } catch (err) {
    console.error(
      '[chat] memory load failed:',
      err
    );
  }

  /*
   * Web search / Deep research
   */
  let webSources: WebSource[] = [];

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
          body.deepResearchEnabled === true
        );

      if (webSources.length > 0) {
        const context = webSources
          .map(
            (source) =>
              `[${source.id}] ${source.title} (${source.domain})\n` +
              `${source.snippet}\nURL: ${source.url}`
          )
          .join('\n\n');

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
        err
      );

      turns.unshift({
        role: 'system',
        content:
          'Web search was unavailable for this request. Do not claim that you searched the web ' +
          'or cite sources that were not actually returned.'
      });
    }
  }

  /*
   * Files / RAG
   */
  if (fileIds.length > 0) {
    try {
      /*
       * IMPORTANT SECURITY CHANGE:
       *
       * The database itself now filters by userId.
       *
       * We no longer fetch arbitrary file IDs and then perform an
       * application-side ownership check.
       */
      const fileRecords =
        await getFilesByIds(
          fileIds,
          userId
        );

      /*
       * Every requested file must belong to this user.
       */
      if (
        fileRecords.length !==
        fileIds.length
      ) {
        return jsonError(
          'One or more files are not accessible to this account.',
          403
        );
      }

      /*
       * If a file is attached to a specific conversation, it must belong
       * to the same conversation.
       *
       * Files without conversationId remain usable by the owner.
       */
      const invalidConversationFile =
        fileRecords.some(
          (file) =>
            file.conversationId &&
            file.conversationId !==
              conversationId
        );

      if (invalidConversationFile) {
        return jsonError(
          'One or more files are not attached to this conversation.',
          403
        );
      }

      const imageFiles =
        fileRecords.filter(
          (file) =>
            file.mimeType.startsWith(
              'image/'
            )
        );

      const textFileIds =
        fileRecords
          .filter(
            (file) =>
              !file.mimeType.startsWith(
                'image/'
              )
          )
          .map((file) => file.id);

      /*
       * Images → vision input
       */
      if (imageFiles.length > 0) {
        const storage =
          getStorageProvider();

        const imageParts: ContentPart[] =
          [];

        for (const image of imageFiles) {
          try {
            const buffer =
              await storage.read(
                image.storagePath
              );

            imageParts.push({
              type: 'image',
              mimeType: image.mimeType,
              data: buffer.toString(
                'base64'
              )
            });
          } catch (err) {
            console.error(
              '[chat] failed to read image:',
              err
            );
          }
        }

        if (imageParts.length > 0) {
          const lastTurn =
            turns[turns.length - 1];

          if (
            lastTurn &&
            lastTurn.role === 'user'
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
       * Text files → RAG
       */
      if (textFileIds.length > 0) {
        const embeddingsProvider =
          getEmbeddingsProvider();

        const [queryEmbedding] =
          await embeddingsProvider.embed([
            message
          ]);

        if (!queryEmbedding) {
          throw new Error(
            'Failed to generate embedding for the message.'
          );
        }

        /*
         * IMPORTANT:
         * Pass userId so pgvector retrieval itself is ownership-aware.
         */
        const matches =
          await searchSimilarChunks(
            textFileIds,
            queryEmbedding,
            6,
            userId
          );

        if (matches.length > 0) {
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
        err
      );

      turns.unshift({
        role: 'system',
        content:
          'File retrieval was unavailable for this request. Do not claim that you read or analyzed ' +
          'file contents that were not successfully retrieved.'
      });
    }
  }

  const encoder =
    new TextEncoder();

  const finalConversationId =
    conversationId as string;

  const stream =
    new ReadableStream({
      async start(controller) {
        controller.enqueue(
          encoder.encode(
            `__META__${JSON.stringify({
              conversationId:
                finalConversationId
            })}\n`
          )
        );

        let fullText = '';

        try {
          const generator =
            provider.stream({
              messages: turns,
              model: resolvedModel
            });

          for await (
            const chunk of generator
          ) {
            fullText += chunk;

            controller.enqueue(
              encoder.encode(chunk)
            );
          }

          if (
            webSources.length > 0
          ) {
            controller.enqueue(
              encoder.encode(
                `\n__SOURCES__${JSON.stringify(
                  webSources
                )}`
              )
            );
          }

          await addMessage(
            finalConversationId,
            'assistant',
            fullText,
            resolvedModel
          );

          /*
           * SECURITY:
           * renameConversation() now requires userId.
           */
          if (isNewConversation) {
            await renameConversation(
              userId,
              finalConversationId,
              deriveTitle(message)
            );
          }
        } catch (err) {
          const errorMessage =
            err instanceof Error
              ? err.message
              : 'Generation failed';

          controller.enqueue(
            encoder.encode(
              `\n[error] ${errorMessage}`
            )
          );

          if (fullText) {
            await addMessage(
              finalConversationId,
              'assistant',
              fullText,
              resolvedModel
            ).catch(() => {});
          }
        } finally {
          controller.close();
        }
      }
    });

  return new Response(stream, {
    headers: {
      'Content-Type':
        'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options':
        'nosniff'
    }
  });
}
