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
 * Brave Search API. Chosen because it has a straightforward REST surface
 * (no SDK dependency needed) and a generous free tier for development.
 * Swap the fetch call below for Tavily/Serper/Bing if you prefer — the
 * SearchProvider interface is what the rest of the app depends on.
 */
class BraveSearchProvider implements SearchProvider {
  async search(query: string, count = 5): Promise<WebSource[]> {
    const apiKey = process.env.SEARCH_API_KEY;
    if (!apiKey) {
      throw new Error('SEARCH_API_KEY is not set. Add a Brave Search API key to .env.local.');
    }

    const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${count}`;
    const res = await fetch(url, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey }
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Brave search failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      web?: { results?: { title: string; url: string; description?: string }[] };
    };
    const results = data.web?.results ?? [];

    return results.map((r, i) => {
      let domain = r.url;
      try {
        domain = new URL(r.url).hostname.replace(/^www\./, '');
      } catch {
        // leave as-is if the URL somehow doesn't parse
      }
      return { id: i + 1, title: r.title, url: r.url, domain, snippet: r.description ?? '' };
    });
  }
}

let cached: SearchProvider | null = null;

export function getSearchProvider(): SearchProvider {
  if (!cached) cached = new BraveSearchProvider();
  return cached;
}
