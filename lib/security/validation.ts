import { z } from 'zod';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const MAX_CHAT_MESSAGE_LENGTH = 100_000;
const MAX_TITLE_LENGTH = 200;
const MAX_NAME_LENGTH = 80;
const MAX_MEMORY_LENGTH = 1_000;
const MAX_FILE_IDS = 20;
const MAX_PAGE_SIZE = 100;

export class ValidationError extends Error {
  public readonly status = 400 as const;
  public readonly issues: string[];

  constructor(
    message = 'Invalid request.',
    issues: string[] = []
  ) {
    super(message);
    this.name = 'ValidationError';
    this.issues = issues;
  }
}

export function isValidUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    UUID_REGEX.test(value.trim())
  );
}

export function requireUuid(
  value: unknown,
  fieldName = 'id'
): string {
  if (!isValidUuid(value)) {
    throw new ValidationError(
      `${fieldName} must be a valid UUID.`,
      [`Invalid ${fieldName}.`]
    );
  }

  return value.trim();
}

export function optionalUuid(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  return requireUuid(value);
}

export function isValidEmail(
  value: unknown
): value is string {
  if (typeof value !== 'string') {
    return false;
  }

  const email = value.trim().toLowerCase();

  if (
    email.length < 3 ||
    email.length > 320
  ) {
    return false;
  }

  return z.string().email().safeParse(email).success;
}

export function requireEmail(
  value: unknown
): string {
  if (!isValidEmail(value)) {
    throw new ValidationError(
      'Please provide a valid email address.',
      ['Invalid email address.']
    );
  }

  return value.trim().toLowerCase();
}

export function sanitizePlainText(
  value: unknown,
  maxLength: number
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      'Expected a text value.'
    );
  }

  return value
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

export function optionalPlainText(
  value: unknown,
  maxLength: number
): string | undefined {
  if (
    value === undefined ||
    value === null
  ) {
    return undefined;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(
      'Expected a text value.'
    );
  }

  return value
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);
}

export function validateChatMessage(
  value: unknown
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      'Message must be a string.'
    );
  }

  const message = value
    .replace(/\u0000/g, '')
    .trim();

  if (!message) {
    throw new ValidationError(
      'Message cannot be empty.'
    );
  }

  if (
    message.length >
    MAX_CHAT_MESSAGE_LENGTH
  ) {
    throw new ValidationError(
      `Message is too long. Maximum length is ${MAX_CHAT_MESSAGE_LENGTH.toLocaleString()} characters.`
    );
  }

  return message;
}

export function validateConversationTitle(
  value: unknown
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      'Conversation title must be a string.'
    );
  }

  const title = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) {
    throw new ValidationError(
      'Conversation title cannot be empty.'
    );
  }

  if (
    title.length >
    MAX_TITLE_LENGTH
  ) {
    throw new ValidationError(
      `Conversation title cannot exceed ${MAX_TITLE_LENGTH} characters.`
    );
  }

  return title;
}

export function validateDisplayName(
  value: unknown
): string | null {
  if (
    value === undefined ||
    value === null ||
    value === ''
  ) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(
      'Name must be a string.'
    );
  }

  const name = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!name) {
    return null;
  }

  if (
    name.length >
    MAX_NAME_LENGTH
  ) {
    throw new ValidationError(
      `Name cannot exceed ${MAX_NAME_LENGTH} characters.`
    );
  }

  return name;
}

export function validateMemoryContent(
  value: unknown
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      'Memory content must be a string.'
    );
  }

  const content = value
    .replace(/\u0000/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!content) {
    throw new ValidationError(
      'Memory content cannot be empty.'
    );
  }

  if (
    content.length >
    MAX_MEMORY_LENGTH
  ) {
    throw new ValidationError(
      `Memory cannot exceed ${MAX_MEMORY_LENGTH} characters.`
    );
  }

  return content;
}

export function validateFileIds(
  value: unknown
): string[] {
  if (
    value === undefined ||
    value === null
  ) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ValidationError(
      'fileIds must be an array.'
    );
  }

  if (
    value.length >
    MAX_FILE_IDS
  ) {
    throw new ValidationError(
      `A maximum of ${MAX_FILE_IDS} files can be attached to one request.`
    );
  }

  const ids: string[] = [];

  for (const item of value) {
    const id = requireUuid(
      item,
      'fileId'
    );

    if (!ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}

export function validatePagination(
  pageValue: unknown,
  pageSizeValue: unknown
): {
  page: number;
  pageSize: number;
  offset: number;
} {
  let page = 1;
  let pageSize = 50;

  if (
    pageValue !== undefined &&
    pageValue !== null &&
    pageValue !== ''
  ) {
    const parsed = Number(pageValue);

    if (
      !Number.isInteger(parsed) ||
      parsed < 1
    ) {
      throw new ValidationError(
        'Page must be a positive integer.'
      );
    }

    page = parsed;
  }

  if (
    pageSizeValue !== undefined &&
    pageSizeValue !== null &&
    pageSizeValue !== ''
  ) {
    const parsed = Number(
      pageSizeValue
    );

    if (
      !Number.isInteger(parsed) ||
      parsed < 1
    ) {
      throw new ValidationError(
        'Page size must be a positive integer.'
      );
    }

    pageSize = Math.min(
      parsed,
      MAX_PAGE_SIZE
    );
  }

  return {
    page,
    pageSize,
    offset: (page - 1) * pageSize
  };
}

export function validateBoolean(
  value: unknown,
  defaultValue = false
): boolean {
  if (
    value === undefined ||
    value === null
  ) {
    return defaultValue;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    const normalized =
      value.trim().toLowerCase();

    if (
      normalized === 'true' ||
      normalized === '1'
    ) {
      return true;
    }

    if (
      normalized === 'false' ||
      normalized === '0'
    ) {
      return false;
    }
  }

  throw new ValidationError(
    'Expected a boolean value.'
  );
}

export function validateModelId(
  value: unknown
): string {
  if (typeof value !== 'string') {
    throw new ValidationError(
      'Model must be a string.'
    );
  }

  const model = value
    .trim()
    .toLowerCase();

  if (!model) {
    throw new ValidationError(
      'Model cannot be empty.'
    );
  }

  if (
    model.length > 100 ||
    !/^[a-z0-9._:-]+$/i.test(model)
  ) {
    throw new ValidationError(
      'Invalid model identifier.'
    );
  }

  return model;
}

export function validatePreferences(
  value: unknown
): Record<string, unknown> {
  if (
    value === undefined ||
    value === null
  ) {
    return {};
  }

  if (
    typeof value !== 'object' ||
    Array.isArray(value)
  ) {
    throw new ValidationError(
      'Preferences must be an object.'
    );
  }

  const result: Record<string, unknown> = {};

  for (
    const [key, item] of Object.entries(
      value as Record<string, unknown>
    )
  ) {
    if (
      !/^[a-zA-Z0-9_.-]{1,80}$/.test(
        key
      )
    ) {
      continue;
    }

    if (
      typeof item === 'string'
    ) {
      result[key] =
        item
          .replace(/\u0000/g, '')
          .slice(0, 2_000);
      continue;
    }

    if (
      typeof item === 'boolean' ||
      typeof item === 'number'
    ) {
      result[key] = item;
      continue;
    }

    if (
      Array.isArray(item)
    ) {
      result[key] =
        item
          .filter(
            (entry) =>
              typeof entry ===
                'string' ||
              typeof entry ===
                'number' ||
              typeof entry ===
                'boolean'
          )
          .slice(0, 50);
    }
  }

  return result;
}

export function parseJsonObject(
  value: unknown
): Record<string, unknown> {
  if (
    typeof value !== 'object' ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new ValidationError(
      'Expected a JSON object.'
    );
  }

  return value as Record<
    string,
    unknown
  >;
}

export function validationErrorResponse(
  error: unknown
): Response {
  if (
    error instanceof ValidationError
  ) {
    return Response.json(
      {
        error: 'VALIDATION_ERROR',
        message: error.message,
        issues: error.issues
      },
      {
        status: 400
      }
    );
  }

  return Response.json(
    {
      error: 'VALIDATION_ERROR',
      message: 'Invalid request.'
    },
    {
      status: 400
    }
  );
}
