/**
 * Provider-agnostic AI interface. Every model provider (Anthropic, OpenAI,
 * Google, local models, etc.) implements this contract so the rest of the
 * app never talks to a vendor SDK directly. Swap providers by changing
 * MERIDIAN_MODEL_PROVIDER in .env — no UI or route code changes.
 */

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GenerateOptions {
  messages: ChatTurn[];
  model: string;
  maxTokens?: number;
  temperature?: number;
  tools?: ToolDefinition[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export interface GenerateResult {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: 'stop' | 'tool_call' | 'length' | 'error';
}

export interface AIProvider {
  /** Non-streaming generation. */
  generate(options: GenerateOptions): Promise<GenerateResult>;

  /** Streaming generation; yields incremental text chunks. */
  stream(options: GenerateOptions): AsyncGenerator<string, GenerateResult, unknown>;

  /** Vector embeddings for RAG / knowledge base retrieval. */
  embeddings(input: string[]): Promise<number[][]>;

  /** Whether this provider/model supports image input. */
  supportsVision(model: string): boolean;

  /** Whether this provider/model supports tool calling. */
  supportsToolCalling(model: string): boolean;
}

/**
 * Resolves the active provider from environment configuration.
 * Server-side only — never import this file from a client component,
 * since concrete implementations read API keys from process.env.
 */
export function getAIProvider(): AIProvider {
  const providerName = process.env.MERIDIAN_MODEL_PROVIDER;

  if (!providerName) {
    throw new Error(
      'MERIDIAN_MODEL_PROVIDER is not set. Configure a provider in .env.local (see .env.example).'
    );
  }

  switch (providerName) {
    case 'anthropic': {
      // Lazy require avoids bundling the SDK into any client component that
      // might accidentally import this file.
      const { anthropicProvider } = require('@/lib/ai/providers/anthropic');
      return anthropicProvider;
    }
    case 'openai':
      throw new Error(
        'OpenAI provider not yet implemented. Add lib/ai/providers/openai.ts implementing AIProvider and wire it here.'
      );
    default:
      throw new Error(`Unknown MERIDIAN_MODEL_PROVIDER: "${providerName}"`);
  }
}
