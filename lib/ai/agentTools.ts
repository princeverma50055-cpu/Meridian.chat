import type {
  AIProvider,
  ToolCall,
  ToolDefinition
} from '@/lib/ai/provider';

export type MeridianToolName =
  | 'web_search'
  | 'deep_research'
  | 'file_search'
  | 'memory'
  | 'conversation_context';

export interface MeridianToolContext {
  userId: string;
  conversationId?: string;
  model: string;
}

export interface ToolExecutionResult {
  toolName: MeridianToolName;
  success: boolean;
  data: unknown;
  error?: string;
}

export interface ToolExecutionInput {
  name: MeridianToolName;
  input: Record<string, unknown>;
}

const WEB_SEARCH_SCHEMA: Record<
  string,
  unknown
> = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'A concise web search query.'
    },
    maxResults: {
      type: 'number',
      description:
        'Maximum number of search results. Maximum 8.'
    }
  },
  required: ['query']
};

const DEEP_RESEARCH_SCHEMA: Record<
  string,
  unknown
> = {
  type: 'object',
  properties: {
    question: {
      type: 'string',
      description:
        'The research question that requires multiple web searches and source synthesis.'
    },
    maxResults: {
      type: 'number',
      description:
        'Maximum number of sources to collect. Maximum 8.'
    }
  },
  required: ['question']
};

const FILE_SEARCH_SCHEMA: Record<
  string,
  unknown
> = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'A semantic search query for the user’s uploaded files.'
    },
    fileIds: {
      type: 'array',
      description:
        'Optional list of file IDs to restrict the search to.',
      items: {
        type: 'string'
      }
    }
  },
  required: ['query']
};

const MEMORY_SCHEMA: Record<
  string,
  unknown
> = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'Information that may be relevant from the user’s saved memories.'
    }
  },
  required: ['query']
};

const CONVERSATION_CONTEXT_SCHEMA: Record<
  string,
  unknown
> = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'What information should be retrieved from the current conversation context?'
    }
  },
  required: ['query']
};

const TOOL_DEFINITIONS: ToolDefinition[] =
  [
    {
      name: 'web_search',
      description:
        'Search the live web for current or factual information and return relevant sources.',
      inputSchema:
        WEB_SEARCH_SCHEMA
    },
    {
      name: 'deep_research',
      description:
        'Perform deeper multi-query web research and gather multiple sources before answering.',
      inputSchema:
        DEEP_RESEARCH_SCHEMA
    },
    {
      name: 'file_search',
      description:
        'Search the authenticated user’s uploaded files for relevant information.',
      inputSchema:
        FILE_SEARCH_SCHEMA
    },
    {
      name: 'memory',
      description:
        'Retrieve relevant saved memories belonging only to the authenticated user.',
      inputSchema:
        MEMORY_SCHEMA
    },
    {
      name: 'conversation_context',
      description:
        'Retrieve relevant context from the current authenticated conversation.',
      inputSchema:
        CONVERSATION_CONTEXT_SCHEMA
    }
  ];

const ALLOWED_TOOL_NAMES =
  new Set<MeridianToolName>(
    TOOL_DEFINITIONS.map(
      (tool) =>
        tool.name as MeridianToolName
    )
  );

export function getMeridianToolDefinitions(): ToolDefinition[] {
  return TOOL_DEFINITIONS.map(
    (tool) => ({
      ...tool,
      inputSchema: {
        ...tool.inputSchema
      }
    })
  );
}

export function getMeridianToolDefinition(
  name: string
): ToolDefinition | null {
  if (
    !isMeridianToolName(name)
  ) {
    return null;
  }

  return (
    TOOL_DEFINITIONS.find(
      (tool) =>
        tool.name === name
    ) ?? null
  );
}

export function isMeridianToolName(
  value: unknown
): value is MeridianToolName {
  return (
    typeof value === 'string' &&
    ALLOWED_TOOL_NAMES.has(
      value as MeridianToolName
    )
  );
}

function cleanString(
  value: unknown,
  maxLength: number
): string {
  if (
    typeof value !== 'string'
  ) {
    return '';
  }

  return value
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanPositiveInteger(
  value: unknown,
  fallback: number,
  maximum: number
): number {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(value);

  if (
    !Number.isFinite(parsed) ||
    parsed < 1
  ) {
    return fallback;
  }

  return Math.min(
    Math.floor(parsed),
    maximum
  );
}

function cleanStringArray(
  value: unknown,
  maximum: number
): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];

  for (
    const item of value
  ) {
    const cleaned =
      cleanString(item, 200);

    if (
      cleaned &&
      !result.includes(cleaned)
    ) {
      result.push(cleaned);
    }

    if (
      result.length >= maximum
    ) {
      break;
    }
  }

  return result;
}

export function normalizeToolInput(
  name: MeridianToolName,
  input: Record<string, unknown>
): Record<string, unknown> {
  switch (name) {
    case 'web_search':
      return {
        query: cleanString(
          input.query,
          1_000
        ),
        maxResults:
          cleanPositiveInteger(
            input.maxResults,
            5,
            8
          )
      };

    case 'deep_research':
      return {
        question: cleanString(
          input.question,
          2_000
        ),
        maxResults:
          cleanPositiveInteger(
            input.maxResults,
            8,
            8
          )
      };

    case 'file_search':
      return {
        query: cleanString(
          input.query,
          2_000
        ),
        fileIds:
          cleanStringArray(
            input.fileIds,
            20
          )
      };

    case 'memory':
      return {
        query: cleanString(
          input.query,
          1_000
        )
      };

    case 'conversation_context':
      return {
        query: cleanString(
          input.query,
          1_000
        )
      };

    default:
      return {};
  }
}

export function validateToolCall(
  toolCall: ToolCall
): ToolExecutionInput {
  if (
    !isMeridianToolName(
      toolCall.toolName
    )
  ) {
    throw new Error(
      `Unsupported Meridian tool: ${toolCall.toolName}`
    );
  }

  const definition =
    getMeridianToolDefinition(
      toolCall.toolName
    );

  if (!definition) {
    throw new Error(
      `Tool definition not found: ${toolCall.toolName}`
    );
  }

  return {
    name: toolCall.toolName,
    input:
      normalizeToolInput(
        toolCall.toolName,
        toolCall.input ?? {}
      )
  };
}

export function attachMeridianTools(
  provider: AIProvider,
  model: string
): ToolDefinition[] {
  if (
    !provider.supportsToolCalling(
      model
    )
  ) {
    return [];
  }

  return getMeridianToolDefinitions();
}

export function shouldUseTool(
  provider: AIProvider,
  model: string,
  toolName: MeridianToolName
): boolean {
  if (
    !provider.supportsToolCalling(
      model
    )
  ) {
    return false;
  }

  return isMeridianToolName(
    toolName
  );
}

export function createToolError(
  toolName: MeridianToolName,
  message: string
): ToolExecutionResult {
  return {
    toolName,
    success: false,
    data: null,
    error: message
  };
}

export function createToolSuccess(
  toolName: MeridianToolName,
  data: unknown
): ToolExecutionResult {
  return {
    toolName,
    success: true,
    data
  };
}

export async function executeMeridianTool(
  toolCall: ToolCall,
  context: MeridianToolContext
): Promise<ToolExecutionResult> {
  const validated =
    validateToolCall(
      toolCall
    );

  if (
    !context.userId
  ) {
    return createToolError(
      validated.name,
      'Authenticated user context is required.'
    );
  }

  switch (validated.name) {
    case 'web_search':
      return createToolError(
        validated.name,
        'Web search execution must be handled by the server search pipeline.'
      );

    case 'deep_research':
      return createToolError(
        validated.name,
        'Deep research execution must be handled by the server research pipeline.'
      );

    case 'file_search':
      return createToolError(
        validated.name,
        'File search execution must be handled by the authenticated server file-search pipeline.'
      );

    case 'memory':
      return createToolError(
        validated.name,
        'Memory execution must be handled by the authenticated server memory pipeline.'
      );

    case 'conversation_context':
      return createToolError(
        validated.name,
        'Conversation-context execution must be handled by the authenticated server conversation pipeline.'
      );

    default:
      return createToolError(
        validated.name,
        'Unsupported tool.'
      );
  }
}

export function getToolsForAgent(
  provider: AIProvider,
  model: string
): ToolDefinition[] {
  return attachMeridianTools(
    provider,
    model
  );
}

export function serializeToolResult(
  result: ToolExecutionResult
): string {
  return JSON.stringify(
    {
      tool: result.toolName,
      success: result.success,
      data: result.data,
      error:
        result.error ?? null
    }
  );
}
