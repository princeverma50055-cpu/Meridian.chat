import { NextRequest } from 'next/server';
import { getAIProvider, type ChatTurn, type ContentPart } from '@/lib/ai/provider';
import { resolveModel } from '@/lib/ai/models';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { getEmbeddingsProvider } from '@/lib/embeddings/provider';
import { searchSimilarChunks, getFilesByIds } from '@/lib/db/files';
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
}

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' }
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as ChatRequestBody | null;

  if (!body || typeof body.message !== 'string' || typeof body.model !== 'string') {
    return jsonError('Expected { message: string, model: string, conversationId?: string }', 400);
  }

  let provider;
  let resolvedModel: string;
  try {
    provider = getAIProvider();
    resolvedModel = resolveModel(body.model);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : 'AI provider is not configured.', 503);
  }

  const userId = await getCurrentUserId();

  let conversationId = body.conversationId;
  let history: ChatTurn[] = [];
  let isNewConversation = false;

  try {
    if (!conversationId) {
      const created = await createConversation(userId, deriveTitle(body.message));
      if (!created) {
        return jsonError('Failed to create conversation', 500);
      }
      conversationId = created.id;
      isNewConversation = true;
    } else {
      const existing = await getConversationMessages(conversationId);
      history = existing.map((m) => ({ role: m.role, content: m.content }));
    }

    await addMessage(conversationId, 'user', body.message);
  } catch (err) {
    return jsonError(
      err instanceof Error ? err.message : 'Failed to persist conversation. Is DATABASE_URL set?',
      500
    );
  }

  const turns: ChatTurn[] = [...history, { role: 'user', content: body.message }];

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

  let webSources: WebSource[] = [];

  if (body.webSearchEnabled) {
    try {
      webSources = await performWebSearch(body.message, provider, resolvedModel);

      if (webSources.length > 0) {
        const context = webSources
          .map((s) => `[${s.id}] ${s.title} (${s.domain})\n${s.snippet}\nURL: ${s.url}`)
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
          content: 'Web search returned no results for this question. Say so rather than guessing.'
        });
      }
    } catch (err) {
      turns.unshift({
        role: 'system',
        content: `Note: web search failed (${err instanceof Error ? err.message : 'unknown error'}). Tell the user search wasn't available rather than answering as if it succeeded.`
      });
    }
  }

  if (body.fileIds && body.fileIds.length > 0) {
    try {
      const fileRecords = await getFilesByIds(body.fileIds);
      const imageFiles = fileRecords.filter((f) => f.mimeType.startsWith('image/'));
      const textFileIds = fileRecords.filter((f) => !f.mimeType.startsWith('image/')).map((f) => f.id);

      // Images: fetch bytes, base64-encode, attach directly to the last user
      // turn as vision input — the model actually "sees" them.
      if (imageFiles.length > 0) {
        const storage = getStorageProvider();
        const imageParts: ContentPart[] = [];

        for (const img of imageFiles) {
          try {
            const buffer = await storage.read(img.storagePath);
            imageParts.push({
              type: 'image',
              mimeType: img.mimeType,
              data: buffer.toString('base64')
            });
          } catch (err) {
            console.error('[chat] failed to read image for vision:', err);
          }
        }

        if (imageParts.length > 0) {
          const lastTurn = turns[turns.length - 1];
          if (lastTurn && lastTurn.role === 'user') {
            const textContent = typeof lastTurn.content === 'string' ? lastTurn.content : body.message;
            lastTurn.content = [{ type: 'text', text: textContent }, ...imageParts];
          }
        }
      }

      // Text-based files: existing RAG retrieval pipeline.
      if (textFileIds.length > 0) {
        const embeddingsProvider = getEmbeddingsProvider();
        const [queryEmbedding] = await embeddingsProvider.embed([body.message]);

        if (!queryEmbedding) {
          throw new Error('Failed to generate embedding for the message');
        }

        const matches = await searchSimilarChunks(textFileIds, queryEmbedding, 6);

        if (matches.length > 0) {
          const nameById = new Map(fileRecords.map((f) => [f.id, f.fileName]));
          const context = matches
            .map((m) => `From "${nameById.get(m.file_id) ?? 'file'}":\n${m.content}`)
            .join('\n\n---\n\n');

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
      turns.unshift({
        role: 'system',
        content: `Note: file retrieval failed (${err instanceof Error ? err.message : 'unknown error'}). Answer without file context and mention this to the user.`
      });
    }
  }

  const encoder = new TextEncoder();
  const finalConversationId = conversationId;

  const stream = new ReadableStream({
    async start(controller) {
      controller.enqueue(
        encoder.encode(`__META__${JSON.stringify({ conversationId: finalConversationId })}\n`)
      );

      let fullText = '';
      try {
        const generator = provider.stream({ messages: turns, model: resolvedModel });
        for await (const chunk of generator) {
          fullText += chunk;
          controller.enqueue(encoder.encode(chunk));
        }

        if (webSources.length > 0) {
          controller.enqueue(encoder.encode(`\n__SOURCES__${JSON.stringify(webSources)}`));
        }

        await addMessage(finalConversationId, 'assistant', fullText, resolvedModel);

        if (isNewConversation) {
          await renameConversation(finalConversationId, deriveTitle(body.message));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Generation failed';
        controller.enqueue(encoder.encode(`\n[error] ${message}`));
        if (fullText) {
          await addMessage(finalConversationId, 'assistant', fullText, resolvedModel).catch(() => {});
        }
      } finally {
        controller.close();
      }
    }
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
  });
}
