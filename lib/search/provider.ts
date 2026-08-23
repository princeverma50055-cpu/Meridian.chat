export interface WebSource {
  id: number;
  title: string;
  domain: string;
  url: string;
  snippet: string;
}

export interface SearchProvider {
  search(query: string, count?: number): Promise<WebSource[]>;
}

/**
 * Tavily — built specifically for AI/agent use cases, with a free tier
 * (1,000 credits/month, no credit card) that's more accessible than most
 * general-purpose search APIs. Swap this for Brave/Serper/Bing if you
 * prefer — the SearchProvider interface is what the rest of the app depends on.
 */
class TavilySearchProvider implements SearchProvider {
  async search(query: string, count = 5): Promise<WebSource[]> {
    const apiKey = process.env.SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error('SEARCH_API_KEY is not set. Add a Tavily API key to .env.local.');
    }

    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query,
        max_results: count,
        search_depth: 'basic'
      })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Tavily search failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      results?: { title: string; url: string; content?: string }[];
    };
    const results = data.results ?? [];

    return results.map((r, i) => {
      let domain = r.url;
      try {
        domain = new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        // leave as-is if the URL somehow doesn't parse
      }
      return { id: i + 1, title: r.title, url: r.url, domain, snippet: r.content ?? '' };
    });
  }
}

let cached: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (!cached) cached = new TavilySearchProvider();
  return cached;
}
