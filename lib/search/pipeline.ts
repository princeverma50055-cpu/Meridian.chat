import type { AIProvider } from '@/lib/ai/provider';
import { getSearchProvider, type WebSource } from '@/lib/search/provider';

/**
 * Asks the model to break the user's question into up to 3 short, distinct
 * search queries — this is the "analyze the question / generate search
 * queries" step from the spec, rather than just searching the raw message
 * verbatim. Falls back to the raw message if the model doesn't return
 * clean JSON, so a parsing hiccup never blocks the search entirely.
 */
export async function generateSearchQueries(
  message: string,
  provider: AIProvider,
  model: string
): Promise<string[]> {
  try {
    const result = await provider.generate({
      model,
      maxTokens: 200,
      messages: [
        {
          role: 'system',
          content:
            'Generate up to 3 short, distinct web search queries (3-6 words each) that would ' +
            'help answer the user\'s question thoroughly. Respond with ONLY a JSON array of ' +
            'strings — no markdown, no explanation.'
        },
        { role: 'user', content: message }
      ]
    });

    const parsed = JSON.parse(result.content.trim());
    if (Array.isArray(parsed) && parsed.length > 0 && parsed.every((q) => typeof q === 'string')) {
      return parsed.slice(0, 3);
    }
    return [message];
  } catch {
    return [message];
  }
}

/**
 * Runs the full "search multiple sources → retrieve → rank" pipeline and
 * returns a deduplicated, sequentially-numbered source list capped at 8 —
 * enough for a grounded answer without overwhelming the context window or
 * the source-card UI.
 */
export async function performWebSearch(
  message: string,
  aiProvider: AIProvider,
  model: string
): Promise<WebSource[]> {
  const search = getSearchProvider();
  const queries = await generateSearchQueries(message, aiProvider, model);

  const resultSets = await Promise.all(
    queries.map((q) => search.search(q, 5).catch(() => [] as WebSource[]))
  );

  const seen = new Set<string>();
  const merged: WebSource[] = [];
  for (const set of resultSets) {
    for (const source of set) {
      if (seen.has(source.url)) continue;
      seen.add(source.url);
      merged.push(source);
    }
  }

  return merged.slice(0, 8).map((source, i) => ({ ...source, id: i + 1 }));
}
