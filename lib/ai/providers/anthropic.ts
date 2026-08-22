import Anthropic from '@anthropic-ai/sdk';
import type {
  AIProvider,
  ChatTurn,
  GenerateOptions,
  GenerateResult,
  ToolCall
} from '@/lib/ai/provider';

function getClient(): Anthropic {
  const apiKey = process.env.AI_PROVIDER_KEY;
  if (!apiKey) {
    throw new Error('AI_PROVIDER_KEY is not set. Add your Anthropic API key to .env.local.');
  }
  return new Anthropic({ apiKey });
}

function splitSystemAndTurns(messages: ChatTurn[]): {
  system: string | undefined;
  turns: { role: 'user' | 'assistant'; content: string }[];
} {
  const systemParts = messages.filter((m) => m.role === 'system').map((m) => m.content);
  const turns = messages
    .filter((m): m is ChatTurn & { role: 'user' | 'assistant' } => m.role !== 'system')
    .map((m) => ({ role: m.role, content: m.content }));
  return { system: systemParts.length ? systemParts.join('\n\n') : undefined, turns };
}

export const anthropicProvider: AIProvider = {
  async generate(options: GenerateOptions): Promise<GenerateResult> {
    const client = getClient();
    const { system, turns } = splitSystemAndTurns(options.messages);

    const response = await client.messages.create({
      model: options.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature,
      system,
      messages: turns,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: options.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema
      })) as any
    });

    // Cast to a minimal shape rather than the SDK's exact block union types,
    // which have shifted names across @anthropic-ai/sdk versions — this
    // keeps the provider resilient to a minor-version bump.
    type Block = { type: string; text?: string; name?: string; input?: Record<string, unknown> };
    const blocks = response.content as unknown as Block[];

    const textContent = blocks
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');

    const toolCalls: ToolCall[] = blocks
      .filter((b) => b.type === 'tool_use')
      .map((b) => ({ toolName: b.name ?? '', input: b.input ?? {} }));

    return {
      content: textContent,
      toolCalls: toolCalls.length ? toolCalls : undefined,
      finishReason:
        response.stop_reason === 'tool_use'
          ? 'tool_call'
          : response.stop_reason === 'max_tokens'
            ? 'length'
            : 'stop'
    };
  },

  async *stream(options: GenerateOptions): AsyncGenerator<string, GenerateResult, unknown> {
    const client = getClient();
    const { system, turns } = splitSystemAndTurns(options.messages);

    const stream = client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 2048,
      temperature: options.temperature,
      system,
      messages: turns
    });

    let fullText = '';

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for await (const event of stream as any) {
      if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
        const text: string = event.delta.text;
        fullText += text;
        yield text;
      }
    }

    const finalMessage = await stream.finalMessage();

    return {
      content: fullText,
      finishReason: finalMessage.stop_reason === 'max_tokens' ? 'length' : 'stop'
    };
  },

  async embeddings(): Promise<number[][]> {
    throw new Error(
      'Anthropic does not offer an embeddings endpoint. Configure a separate embeddings ' +
        'provider (e.g. Voyage AI, which Anthropic recommends) for RAG/knowledge-base features.'
    );
  },

  supportsVision(model: string): boolean {
    return !model.includes('haiku') || model.includes('haiku-4');
  },

  supportsToolCalling(): boolean {
    return true;
  }
};
