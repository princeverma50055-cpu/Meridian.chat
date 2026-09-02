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
  getConversationForUser,
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

function jsonError(
  message: string,
  status: number
) {
  return new Response(
    JSON.stringify({
      error: message
    }),
    {
      status,
      headers: {
        'Content-Type':
          'application/json'
      }
    }
  );
}

function normalizeFileIds(
  fileIds: unknown
): string[] {
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
  ].slice(0, 20);
}

export async function POST(
  req: NextRequest
) {
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
      400
    );
  }

  const message =
    body.message.trim();

  if (!message) {
    return jsonError(
      'Message cannot be empty.',
      400
    );
  }

  if (message.length > 50000) {
    return jsonError(
      'Message is too long.',
      400
    );
  }

  const fileIds =
    normalizeFileIds(
      body.fileIds
    );

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
      503
    );
  }

  let userId: string;

  try {
    userId =
      await getCurrentUserId();
  } catch (err) {
    return jsonError(
      'Authentication required.',
      err instanceof UnauthorizedError
        ? 401
        : 500
    );
  }

  let conversationId =
    body.conversationId?.trim();

  let history: ChatTurn[] = [];
  let isNewConversation =
    false;

  try {
    if (!conversationId) {
      const created =
        await createConversation(
          userId,
          deriveTitle(message)
        );

      if (!created) {
        return jsonError(
          'Failed to create conversation.',
          500
        );
      }

      conversationId =
        created.id;

      isNewConversation =
        true;
    } else {
      const existing =
        await getConversationForUser(
          conversationId,
          userId
        );

      if (!existing) {
        return jsonError(
          'Conversation not found.',
          404
        );
      }

      const existingMessages =
        await getConversationMessages(
          conversationId,
          userId
        );

      if (!existingMessages) {
        return jsonError(
          'Conversation not found.',
          404
        );
      }

      history =
        existingMessages.map(
          (m) => ({
            role: m.role,
            content: m.content
          })
        );
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
      '[chat] Conversation persistence failed:',
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
      'You are Meridian, an AI assistant built by ProjectX Hub. Always identify yourself as Meridian. Never mention Google, Gemini, Anthropic, Claude, or any underlying AI provider — that information is private implementation detail, not something to share even if asked directly.\n\n' +
      'If asked who made you or who your founder/creator is, say: Meridian was built by ProjectX Hub, and ProjectX Hub was founded by Prince Verma.\n\n' +
      'If asked for links or how to contact/connect with the founder or ProjectX Hub, share these:\n' +
      '- Prince Verma\'s LinkedIn: https://www.linkedin.com/in/prince-verma-2b100240a\n' +
      '- ProjectX Hub website: https://projectxhub.in\n\n' +
      'Only share these links when relevant to what\'s being asked — don\'t volunteer them unprompted in unrelated conversations.'
  });

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

    if (
      profile?.profile
        ?.preferences &&
      (profile.profile
        .preferences as {
        memoryEnabled?: boolean;
      }).memoryEnabled !==
        false
    ) {
      const memories =
        await getMemories(
          userId
        );

      if (memories.length) {
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
    console.error(
      '[chat] Memory load failed:',
      err
    );
  }

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

      if (webSources.length > 0) {
        const context =
          webSources
            .map(
              (source) =>
                `[${source.id}] ${source.title} (${source.domain})\n${source.snippet}\nURL: ${source.url}`
            )
            .join('\n\n');

        turns.unshift({
          role: 'system',
          content:
            'Web search results for the user\'s question are below. Cite sources inline using [1], [2], etc. matching the numbers below. Only cite a source for claims it actually supports — never fabricate a citation or invent a source that isn\'t listed here. If the results don\'t answer the question, say so.\n\n' +
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
        '[chat] Web search failed:',
        err
      );

      turns.unshift({
        role: 'system',
        content:
          'Web search was unavailable for this request. Do not pretend that web search succeeded.'
      });
    }
  }

  if (fileIds.length > 0) {
    try {
      const allFileRecords =
        await getFilesByIds(
          fileIds
        );

      const fileRecords =
        allFileRecords.filter(
          (file) =>
            file.userId ===
              userId &&
            (
              !file.conversationId ||
              file.conversationId ===
                conversationId
            )
        );

      if (
        fileRecords.length !==
        fileIds.length
      ) {
        return jsonError(
          'One or more files are not accessible to this account.',
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
          .map(
            (file) => file.id
          );

      if (
        imageFiles.length > 0
      ) {
        const storage =
          getStorageProvider();

        const imageParts:
          ContentPart[] = [];

        for (
          const imageFile of imageFiles
        ) {
          try {
            const buffer =
              await storage.read(
                imageFile.storagePath
              );

            imageParts.push({
              type: 'image',
              mimeType:
                imageFile.mimeType,
              data: buffer.toString(
                'base64'
              )
            });
          } catch (err) {
            console.error(
              '[chat] Failed to read image:',
              err
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

      if (
        textFileIds.length > 0
      ) {
        const embeddingsProvider =
          getEmbeddingsProvider();

        const [
          queryEmbedding
        ] =
          await embeddingsProvider.embed(
            [message]
          );

        if (!queryEmbedding) {
          throw new Error(
            'Failed to generate embedding for the message.'
          );
        }

        const matches =
          await searchSimilarChunks(
            textFileIds,
            queryEmbedding,
            6
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
              'The user has attached file(s). Use the following retrieved excerpts to answer if relevant, and cite which file each fact comes from. If the excerpts don\'t contain the answer, say so rather than guessing.\n\n' +
              context
          });
        }
      }
    } catch (err) {
      console.error(
        '[chat] File retrieval failed:',
        err
      );

      turns.unshift({
        role: 'system',
        content:
          'File retrieval was unavailable for this request. Answer without file context and clearly mention that file context could not be accessed.'
      });
    }
  }

  const encoder =
    new TextEncoder();

  const finalConversationId =
    conversationId as string;

  const stream =
    new ReadableStream({
      async start(
        controller
      ) {
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
          console.error(
            '[chat] Generation failed:',
            err
          );

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
            ).catch(
              () => {}
            );
          }
        } finally {
          controller.close();
        }
      }
    });

  return new Response(
    stream,
    {
      headers: {
        'Content-Type':
          'text/plain; charset=utf-8',
        'Cache-Control':
          'no-cache, no-transform',
        Connection: 'keep-alive'
      }
    }
  );
}
