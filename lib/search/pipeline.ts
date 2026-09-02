import type { AIProvider } from '@/lib/ai/provider';
import {
  getSearchProvider,
  type WebSource
} from '@/lib/search/provider';

export async function generateSearchQueries(
  message: string,
  provider: AIProvider,
  model: string
): Promise<string[]> {
  try {
    const result =
      await provider.generate({
        model,
        maxTokens: 200,
        messages: [
          {
            role: 'system',
            content:
              'Generate up to 3 short, distinct web search queries (3-6 words each) that would help answer the user question thoroughly. Respond with ONLY a JSON array of strings.'
          },
          {
            role: 'user',
            content: message
          }
        ]
      });

    const parsed = JSON.parse(
      result.content.trim()
    );

    if (
      Array.isArray(parsed) &&
      parsed.length > 0 &&
      parsed.every(
        (query) =>
          typeof query === 'string'
      )
    ) {
      return parsed
        .slice(0, 3)
        .map((query) =>
          query.trim()
        )
        .filter(Boolean);
    }

    return [message];
  } catch {
    return [message];
  }
}

export async function performWebSearch(
  message: string,
  aiProvider: AIProvider,
  model: string,
  deepResearch = false
): Promise<WebSource[]> {
  const search =
    getSearchProvider();

  const queries =
    await generateSearchQueries(
      message,
      aiProvider,
      model
    );

  /*
   * Deep research gets broader retrieval.
   * Normal web search remains lightweight.
   */
  const perQueryLimit =
    deepResearch ? 8 : 5;

  const resultSets =
    await Promise.all(
      queries.map(
        (query) =>
          search
            .search(
              query,
              perQueryLimit
            )
            .catch(
              () =>
                [] as WebSource[]
            )
      )
    );

  const seen =
    new Set<string>();

  const merged: WebSource[] =
    [];

  for (
    const resultSet of resultSets
  ) {
    for (
      const source of resultSet
    ) {
      if (
        seen.has(source.url)
      ) {
        continue;
      }

      seen.add(source.url);
      merged.push(source);
    }
  }

  const maxSources =
    deepResearch ? 12 : 8;

  return merged
    .slice(0, maxSources)
    .map(
      (source, index) => ({
        ...source,
        id: index + 1
      })
    );
}
