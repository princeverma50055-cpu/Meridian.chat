import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  users,
  profiles,
  conversations,
  messages,
  files,
  memories,
  authSessions
} from '@/lib/db/schema';
import {
  getStorageProvider
} from '@/lib/storage/provider';

export class AccountServiceError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(
    code: string,
    message: string,
    status = 400
  ) {
    super(message);
    this.name = 'AccountServiceError';
    this.code = code;
    this.status = status;
  }
}

export interface AccountExport {
  exportedAt: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    avatarUrl: string | null;
    createdAt: Date;
  } | null;
  profile: {
    userId: string;
    plan: string;
    preferences: unknown;
    updatedAt: Date;
  } | null;
  conversations: Array<
    typeof conversations.$inferSelect
  >;
  messages: Array<
    typeof messages.$inferSelect
  >;
  files: Array<
    Omit<
      typeof files.$inferSelect,
      'storagePath'
    >
  >;
  memories: Array<
    typeof memories.$inferSelect
  >;
  sessions: Array<{
    id: string;
    createdAt: Date;
    lastSeenAt: Date;
    expiresAt: Date;
    userAgent: string | null;
  }>;
}

function validateUserId(
  userId: string
): string {
  if (
    typeof userId !== 'string' ||
    !userId.trim()
  ) {
    throw new AccountServiceError(
      'INVALID_USER',
      'A valid user ID is required.',
      400
    );
  }

  return userId.trim();
}

async function getUserFileStoragePaths(
  userId: string
): Promise<string[]> {
  const db = getDb();

  const rows = await db
    .select({
      storagePath: files.storagePath
    })
    .from(files)
    .where(
      eq(files.userId, userId)
    );

  return rows
    .map(
      (row) => row.storagePath
    )
    .filter(
      (path): path is string =>
        typeof path === 'string' &&
        path.trim().length > 0
    );
}

async function deleteStorageFiles(
  storagePaths: string[]
): Promise<{
  deleted: number;
  failed: number;
}> {
  if (
    storagePaths.length === 0
  ) {
    return {
      deleted: 0,
      failed: 0
    };
  }

  const storage =
    getStorageProvider();

  let deleted = 0;
  let failed = 0;

  for (
    const storagePath of storagePaths
  ) {
    try {
      await storage.delete(
        storagePath
      );

      deleted += 1;
    } catch (error) {
      failed += 1;

      console.error(
        '[account] Failed to delete storage object:',
        error
      );
    }
  }

  return {
    deleted,
    failed
  };
}

export async function exportAccountData(
  userId: string
): Promise<AccountExport> {
  const normalizedUserId =
    validateUserId(userId);

  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt
    })
    .from(users)
    .where(
      eq(
        users.id,
        normalizedUserId
      )
    )
    .limit(1);

  if (!user) {
    throw new AccountServiceError(
      'USER_NOT_FOUND',
      'Account not found.',
      404
    );
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(
      eq(
        profiles.userId,
        normalizedUserId
      )
    )
    .limit(1);

  const userConversations =
    await db
      .select()
      .from(conversations)
      .where(
        eq(
          conversations.userId,
          normalizedUserId
        )
      );

  const conversationIds =
    userConversations.map(
      (conversation) =>
        conversation.id
    );

  let userMessages: Array<
    typeof messages.$inferSelect
  > = [];

  if (
    conversationIds.length > 0
  ) {
    const allMessages =
      await db
        .select()
        .from(messages);

    const allowedIds =
      new Set(
        conversationIds
      );

    userMessages =
      allMessages.filter(
        (message) =>
          allowedIds.has(
            message.conversationId
          )
      );
  }

  const userFiles =
    await db
      .select({
        id: files.id,
        userId: files.userId,
        conversationId:
          files.conversationId,
        projectId:
          files.projectId,
        fileName:
          files.fileName,
        mimeType:
          files.mimeType,
        sizeBytes:
          files.sizeBytes,
        status:
          files.status,
        errorMessage:
          files.errorMessage,
        createdAt:
          files.createdAt
      })
      .from(files)
      .where(
        eq(
          files.userId,
          normalizedUserId
        )
      );

  const userMemories =
    await db
      .select()
      .from(memories)
      .where(
        eq(
          memories.userId,
          normalizedUserId
        )
      );

  const userSessions =
    await db
      .select({
        id: authSessions.id,
        createdAt:
          authSessions.createdAt,
        lastSeenAt:
          authSessions.lastSeenAt,
        expiresAt:
          authSessions.expiresAt,
        userAgent:
          authSessions.userAgent
      })
      .from(authSessions)
      .where(
        eq(
          authSessions.userId,
          normalizedUserId
        )
      );

  return {
    exportedAt:
      new Date().toISOString(),
    user,
    profile:
      profile ?? null,
    conversations:
      userConversations,
    messages:
      userMessages,
    files:
      userFiles,
    memories:
      userMemories,
    sessions:
      userSessions
  };
}

export async function deleteAllUserConversations(
  userId: string
): Promise<{
  deletedConversations: number;
  deletedFiles: number;
  storageDeleted: number;
  storageFailed: number;
}> {
  const normalizedUserId =
    validateUserId(userId);

  const db = getDb();

  const storagePaths =
    await getUserFileStoragePaths(
      normalizedUserId
    );

  const userFiles =
    await db
      .select({
        id: files.id
      })
      .from(files)
      .where(
        eq(
          files.userId,
          normalizedUserId
        )
      );

  const userConversations =
    await db
      .select({
        id: conversations.id
      })
      .from(conversations)
      .where(
        eq(
          conversations.userId,
          normalizedUserId
        )
      );

  const conversationIds =
    userConversations.map(
      (item) => item.id
    );

  let deletedConversations = 0;

  for (
    const conversationId of
      conversationIds
  ) {
    const deleted =
      await db
        .delete(conversations)
        .where(
          eq(
            conversations.id,
            conversationId
          )
        )
        .returning({
          id: conversations.id
        });

    deletedConversations +=
      deleted.length;
  }

  const deletedFiles =
    userFiles.length;

  await db
    .delete(files)
    .where(
      eq(
        files.userId,
        normalizedUserId
      )
    );

  const storageResult =
    await deleteStorageFiles(
      storagePaths
    );

  return {
    deletedConversations,
    deletedFiles,
    storageDeleted:
      storageResult.deleted,
    storageFailed:
      storageResult.failed
  };
}

export async function deleteAllUserMemories(
  userId: string
): Promise<number> {
  const normalizedUserId =
    validateUserId(userId);

  const db = getDb();

  const deleted =
    await db
      .delete(memories)
      .where(
        eq(
          memories.userId,
          normalizedUserId
        )
      )
      .returning({
        id: memories.id
      });

  return deleted.length;
}

export async function revokeAllUserSessions(
  userId: string
): Promise<number> {
  const normalizedUserId =
    validateUserId(userId);

  const db = getDb();

  const deleted =
    await db
      .delete(authSessions)
      .where(
        eq(
          authSessions.userId,
          normalizedUserId
        )
      )
      .returning({
        id: authSessions.id
      });

  return deleted.length;
}

export async function deleteUserAccount(
  userId: string
): Promise<{
  storageDeleted: number;
  storageFailed: number;
}> {
  const normalizedUserId =
    validateUserId(userId);

  const db = getDb();

  const [user] = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(
      eq(
        users.id,
        normalizedUserId
      )
    )
    .limit(1);

  if (!user) {
    throw new AccountServiceError(
      'USER_NOT_FOUND',
      'Account not found.',
      404
    );
  }

  const storagePaths =
    await getUserFileStoragePaths(
      normalizedUserId
    );

  await db
    .delete(users)
    .where(
      eq(
        users.id,
        normalizedUserId
      )
    );

  const storageResult =
    await deleteStorageFiles(
      storagePaths
    );

  return {
    storageDeleted:
      storageResult.deleted,
    storageFailed:
      storageResult.failed
  };
}

export async function accountExists(
  userId: string
): Promise<boolean> {
  if (
    typeof userId !== 'string' ||
    !userId.trim()
  ) {
    return false;
  }

  const db = getDb();

  const [user] = await db
    .select({
      id: users.id
    })
    .from(users)
    .where(
      eq(
        users.id,
        userId.trim()
      )
    )
    .limit(1);

  return Boolean(user);
}

export function accountServiceErrorResponse(
  error: unknown
): Response {
  if (
    error instanceof AccountServiceError
  ) {
    return Response.json(
      {
        error: error.code,
        message: error.message
      },
      {
        status: error.status
      }
    );
  }

  console.error(
    '[account] Unexpected account service error:',
    error
  );

  return Response.json(
    {
      error: 'ACCOUNT_OPERATION_FAILED',
      message:
        'Unable to complete the account operation.'
    },
    {
      status: 500
    }
  );
}
