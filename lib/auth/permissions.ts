import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  conversations,
  files,
  projects
} from '@/lib/db/schema';

export class ForbiddenError extends Error {
  public readonly status = 403 as const;

  constructor(message = 'You do not have permission to access this resource.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export class ResourceNotFoundError extends Error {
  public readonly status = 404 as const;

  constructor(message = 'The requested resource was not found.') {
    super(message);
    this.name = 'ResourceNotFoundError';
  }
}

function assertUserId(userId: string): void {
  if (!userId || typeof userId !== 'string') {
    throw new ForbiddenError('A valid authenticated user is required.');
  }
}

function assertResourceId(resourceId: string, resourceName: string): void {
  if (!resourceId || typeof resourceId !== 'string') {
    throw new ResourceNotFoundError(`${resourceName} was not found.`);
  }
}

export async function getOwnedConversation(
  userId: string,
  conversationId: string
) {
  assertUserId(userId);
  assertResourceId(conversationId, 'Conversation');

  const db = getDb();

  const [conversation] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);

  if (!conversation) {
    throw new ResourceNotFoundError('Conversation not found.');
  }

  return conversation;
}

export async function requireConversationOwner(
  userId: string,
  conversationId: string
) {
  return getOwnedConversation(userId, conversationId);
}

export async function conversationBelongsToUser(
  userId: string,
  conversationId: string
): Promise<boolean> {
  if (!userId || !conversationId) {
    return false;
  }

  const db = getDb();

  const [conversation] = await db
    .select({
      id: conversations.id
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.id, conversationId),
        eq(conversations.userId, userId)
      )
    )
    .limit(1);

  return Boolean(conversation);
}

export async function getOwnedFile(
  userId: string,
  fileId: string
) {
  assertUserId(userId);
  assertResourceId(fileId, 'File');

  const db = getDb();

  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, userId)
      )
    )
    .limit(1);

  if (!file) {
    throw new ResourceNotFoundError('File not found.');
  }

  return file;
}

export async function requireFileOwner(
  userId: string,
  fileId: string
) {
  return getOwnedFile(userId, fileId);
}

export async function fileBelongsToUser(
  userId: string,
  fileId: string
): Promise<boolean> {
  if (!userId || !fileId) {
    return false;
  }

  const db = getDb();

  const [file] = await db
    .select({
      id: files.id
    })
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, userId)
      )
    )
    .limit(1);

  return Boolean(file);
}

export async function requireFilesOwner(
  userId: string,
  fileIds: string[]
) {
  assertUserId(userId);

  const uniqueFileIds = Array.from(
    new Set(
      fileIds.filter(
        (fileId): fileId is string =>
          typeof fileId === 'string' && fileId.length > 0
      )
    )
  );

  if (uniqueFileIds.length === 0) {
    return [];
  }

  const db = getDb();

  const ownedFiles = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.userId, userId),
        inArray(files.id, uniqueFileIds)
      )
    );

  if (ownedFiles.length !== uniqueFileIds.length) {
    throw new ForbiddenError(
      'One or more requested files do not belong to the authenticated user.'
    );
  }

  const ownedFileIds = new Set(
    ownedFiles.map((file) => file.id)
  );

  const hasForeignFile = uniqueFileIds.some(
    (fileId) => !ownedFileIds.has(fileId)
  );

  if (hasForeignFile) {
    throw new ForbiddenError(
      'One or more requested files are not accessible.'
    );
  }

  return ownedFiles;
}

export async function getOwnedProject(
  userId: string,
  projectId: string
) {
  assertUserId(userId);
  assertResourceId(projectId, 'Project');

  const db = getDb();

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.userId, userId)
      )
    )
    .limit(1);

  if (!project) {
    throw new ResourceNotFoundError('Project not found.');
  }

  return project;
}

export async function requireProjectOwner(
  userId: string,
  projectId: string
) {
  return getOwnedProject(userId, projectId);
}

export async function projectBelongsToUser(
  userId: string,
  projectId: string
): Promise<boolean> {
  if (!userId || !projectId) {
    return false;
  }

  const db = getDb();

  const [project] = await db
    .select({
      id: projects.id
    })
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.userId, userId)
      )
    )
    .limit(1);

  return Boolean(project);
}

export async function requireConversationFilesOwner(
  userId: string,
  conversationId: string,
  fileIds: string[]
) {
  const conversation = await requireConversationOwner(
    userId,
    conversationId
  );

  const ownedFiles = await requireFilesOwner(
    userId,
    fileIds
  );

  const invalidConversationFile = ownedFiles.some(
    (file) =>
      file.conversationId !== null &&
      file.conversationId !== conversation.id
  );

  if (invalidConversationFile) {
    throw new ForbiddenError(
      'One or more files are not attached to this conversation.'
    );
  }

  return {
    conversation,
    files: ownedFiles
  };
}

export function isForbiddenError(error: unknown): error is ForbiddenError {
  return error instanceof ForbiddenError;
}

export function isResourceNotFoundError(
  error: unknown
): error is ResourceNotFoundError {
  return error instanceof ResourceNotFoundError;
}

export function permissionErrorResponse(
  error: unknown
): Response {
  if (error instanceof ResourceNotFoundError) {
    return Response.json(
      {
        error: 'NOT_FOUND',
        message: error.message
      },
      {
        status: 404
      }
    );
  }

  if (error instanceof ForbiddenError) {
    return Response.json(
      {
        error: 'FORBIDDEN',
        message: error.message
      },
      {
        status: 403
      }
    );
  }

  return Response.json(
    {
      error: 'FORBIDDEN',
      message: 'You do not have permission to access this resource.'
    },
    {
      status: 403
    }
  );
}
