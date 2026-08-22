import { NextRequest } from 'next/server';
import { getAIProvider, type ChatTurn } from '@/lib/ai/provider';
import { resolveModel } from '@/lib/ai/models';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { getEmbeddingsProvider } from '@/lib/embeddings/provider';
import { searchSimilarChunks, getFilesByIds } from '@/lib/db/files';
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

/**
 * POST /api/chat
 * Accepts a single new user message (+ optional conversationId to continue
 * an existing thread). Persists the user turn, streams the assistant reply,
 * persists that too, and auto-titles new conversations from the first
 * message — matching the spec's "auto-generate a title" requirement.
 */
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
  let webSources: WebSource[] = [];

  // Web search: generate queries, search, rank, then ground the model with
  // numbered sources it's instructed to cite — never asked to answer from
  // un-sourced knowledge when this is on.
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

  // Retrieval-augmented context: if files are attached, embed the user's
  // question and pull the most relevant chunks in as a system message
  // rather than dumping whole documents into the prompt.
  if (body.fileIds && body.fileIds.length > 0) {
    try {
      const embeddingsProvider = getEmbeddingsProvider();
      const [queryEmbedding] = await embeddingsProvider.embed([body.message]);
      const matches = await searchSimilarChunks(body.fileIds, queryEmbedding, 6);

      if (matches.length > 0) {
        const fileRecords = await getFilesByIds(body.fileIds);
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
    } catch (err) {
      // Retrieval failing shouldn't block the chat turn — surface it as a
      // system note instead so the model (and, via the stream, the user)
      // knows file context wasn't available this time.
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
      // First frame tells the client which conversation this belongs to
      // (needed on first message, when the id was just created server-side).
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
