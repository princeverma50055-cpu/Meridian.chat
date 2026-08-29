export interface TextPart {
  type: 'text';
  text: string;
}

export interface ImagePart {
  type: 'image';
  mimeType: string;
  data: string; // base64
}

export type ContentPart = TextPart | ImagePart;

export interface ChatTurn {
  role: 'system' | 'user' | 'assistant';
  content: string | ContentPart[];
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
  generate(options: GenerateOptions): Promise<GenerateResult>;
  stream(options: GenerateOptions): AsyncGenerator<string, GenerateResult, unknown>;
  embeddings(input: string[]): Promise<number[][]>;
  supportsVision(model: string): boolean;
  supportsToolCalling(model: string): boolean;
}

export function getAIProvider(): AIProvider {
  const providerName = process.env.MERIDIAN_MODEL_PROVIDER;

  if (!providerName) {
    throw new Error(
      'MERIDIAN_MODEL_PROVIDER is not set. Configure a provider in .env.local (see .env.example).'
    );
  }

  switch (providerName) {
    case 'google': {
      const { googleProvider } = require('@/lib/ai/providers/google');
      return googleProvider;
    }
    case 'anthropic':
      throw new Error(
        'Anthropic provider file was removed from this project. Set MERIDIAN_MODEL_PROVIDER=google in .env.local.'
      );
    case 'openai':
      throw new Error(
        'OpenAI provider not yet implemented. Add lib/ai/providers/openai.ts implementing AIProvider and wire it here.'
      );
    default:
      throw new Error(`Unknown MERIDIAN_MODEL_PROVIDER: "${providerName}"`);
  }
}
