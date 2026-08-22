export interface EmbeddingsProvider {
  embed(texts: string[]): Promise<number[][]>;
  dimensions: number;
}

/**
 * Voyage AI — Anthropic's recommended embeddings partner, since Claude
 * models don't expose an embeddings endpoint directly. Uses the plain
 * REST API via fetch rather than an SDK dependency to keep this resilient
 * to SDK churn.
 */
class VoyageEmbeddingsProvider implements EmbeddingsProvider {
  dimensions = 1024; // voyage-3's output size; update if you change VOYAGE_MODEL below

  async embed(texts: string[]): Promise<number[][]> {
    const apiKey = process.env.VOYAGE_API_KEY;
    if (!apiKey) {
      throw new Error('VOYAGE_API_KEY is not set. Add it to .env.local to enable file embeddings.');
    }

    const model = process.env.VOYAGE_MODEL ?? 'voyage-3';

    const res = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ input: texts, model })
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Voyage embeddings request failed (${res.status}): ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as { data: { embedding: number[] }[] };
    return data.data.map((d) => d.embedding);
  }
}

let cached: EmbeddingsProvider | null = null;

export function getEmbeddingsProvider(): EmbeddingsProvider {
  if (!cached) cached = new VoyageEmbeddingsProvider();
  return cached;
}
