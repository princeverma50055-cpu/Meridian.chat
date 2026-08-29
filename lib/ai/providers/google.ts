import { GoogleGenAI } from '@google/genai';
import type { AIProvider, ChatTurn, ContentPart, GenerateOptions, GenerateResult } from '@/lib/ai/provider';

function getClient(): GoogleGenAI {
  const apiKey = process.env.AI_PROVIDER_KEY;
  if (!apiKey) {
    throw new Error('AI_PROVIDER_KEY is not set. Add your Gemini API key to .env.local.');
  }
  return new GoogleGenAI({ apiKey });
}

type GeminiPart = { text: string } | { inlineData: { mimeType: string; data: string } };

function toGeminiParts(content: string | ContentPart[]): GeminiPart[] {
  if (typeof content === 'string') return [{ text: content }];
  return content.map((p) =>
    p.type === 'text' ? { text: p.text } : { inlineData: { mimeType: p.mimeType, data: p.data } }
  );
}

function splitSystemAndContents(messages: ChatTurn[]): {
  systemInstruction: string | undefined;
  contents: { role: 'user' | 'model'; parts: GeminiPart[] }[];
} {
  const systemParts = messages
    .filter((m) => m.role === 'system')
    .map((m) => (typeof m.content === 'string' ? m.content : ''))
    .filter(Boolean);

  const contents = messages
    .filter((m) => m.role !== 'system')
    .map((m) => ({
      role: m.role === 'assistant' ? ('model' as const) : ('user' as const),
      parts: toGeminiParts(m.content)
    }));

  return {
    systemInstruction: systemParts.length ? systemParts.join('\n\n') : undefined,
    contents
  };
}

export const googleProvider: AIProvider = {
  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const ai = getClient();
    const { systemInstruction, contents } = splitSystemAndContents(options.messages);

    const response = await ai.models.generateContent({
      model: options.model,
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: options.maxTokens ?? 2048,
        temperature: options.temperature
      }
    });

    return { content: response.text ?? '', finishReason: 'stop' };
  },

  async *stream(options: GenerateOptions): AsyncGenerator<string, GenerateResult, unknown> {
    const ai = getClient();
    const { systemInstruction, contents } = splitSystemAndContents(options.messages);

    const stream = await ai.models.generateContentStream({
      model: options.model,
      contents,
      config: {
        systemInstruction,
        maxOutputTokens: options.maxTokens ?? 2048,
        temperature: options.temperature
      }
    });

    let fullText = '';
    for await (const chunk of stream) {
      const text = chunk.text ?? '';
      if (text) {
        fullText += text;
        yield text;
      }
    }

    return { content: fullText, finishReason: 'stop' };
  },

  async embeddings(): Promise<number[][]> {
    throw new Error(
      'Embeddings are not wired up through the Gemini chat provider. Meridian uses Voyage AI ' +
        'for embeddings regardless of chat provider — set VOYAGE_API_KEY.'
    );
  },

  supportsVision(): boolean {
    return true;
  },

  supportsToolCalling(): boolean {
    return true;
  }
};
