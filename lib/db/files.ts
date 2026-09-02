import { sql, eq, and, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { files, fileChunks } from '@/lib/db/schema';

function normalizeUserId(userId: string) {
  const value = userId?.trim();

  if (!value) {
    throw new Error('User ID is required.');
  }

  return value;
}

function normalizeFileIds(fileIds: string[]) {
  return [...new Set(
    fileIds
      .filter((id): id is string => typeof id === 'string')
      .map((id) => id.trim())
      .filter(Boolean)
  )];
}

export async function createFileRecord(input: {
  userId: string;
  conversationId?: string;
  projectId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}) {
  const db = getDb();

  const userId = normalizeUserId(input.userId);

  if (!input.fileName?.trim()) {
    throw new Error('File name is required.');
  }

  if (!input.mimeType?.trim()) {
    throw new Error('File MIME type is required.');
  }

  if (!Number.isFinite(input.sizeBytes) || input.sizeBytes < 0) {
    throw new Error('Invalid file size.');
  }

  const [row] = await db
    .insert(files)
    .values({
      userId,
      conversationId: input.conversationId,
      projectId: input.projectId,
      fileName: input.fileName.trim().slice(0, 255),
      mimeType: input.mimeType.trim().slice(0, 150),
      sizeBytes: input.sizeBytes,
      storagePath: input.storagePath,
      status: 'processing'
    })
    .returning();

  return row;
}

export async function setFileStatus(
  fileId: string,
  status: string,
  errorMessage?: string
) {
  const db = getDb();

  if (!fileId?.trim()) {
    throw new Error('File ID is required.');
  }

  await db
    .update(files)
    .set({
      status: status.trim().slice(0, 50),
      errorMessage: errorMessage
        ? errorMessage.slice(0, 1000)
        : null
    })
    .where(eq(files.id, fileId));
}

/**
 * Insert chunks for a file.
 *
 * Ownership is intentionally checked before this function should be called
 * by an authenticated upload/processing flow.
 */
export async function insertFileChunks(
  fileId: string,
  chunks: {
    content: string;
    embedding: number[];
  }[]
) {
  const db = getDb();

  if (!fileId?.trim()) {
    throw new Error('File ID is required.');
  }

  if (chunks.length === 0) {
    return;
  }

  const safeChunks = chunks
    .filter(
      (chunk) =>
        typeof chunk.content === 'string' &&
        chunk.content.trim().length > 0 &&
        Array.isArray(chunk.embedding) &&
        chunk.embedding.length > 0
    )
    .map((chunk) => ({
      content: chunk.content.trim(),
      embedding: chunk.embedding
    }));

  if (safeChunks.length === 0) {
    return;
  }

  await db.insert(fileChunks).values(
    safeChunks.map((chunk, index) => ({
      fileId,
      chunkIndex: index,
      content: chunk.content,
      embedding: chunk.embedding
    }))
  );
}

/**
 * List files belonging to a specific conversation.
 *
 * The userId check is mandatory so a conversation ID alone can never expose
 * another user's files.
 */
export async function listFilesForConversation(
  conversationId: string,
  userId: string
) {
  const db = getDb();

  const safeUserId = normalizeUserId(userId);

  if (!conversationId?.trim()) {
    return [];
  }

  return db
    .select()
    .from(files)
    .where(
      and(
        eq(files.conversationId, conversationId),
        eq(files.userId, safeUserId)
      )
    )
    .orderBy(files.createdAt);
}

export async function listFilesForUser(userId: string) {
  const db = getDb();

  const safeUserId = normalizeUserId(userId);

  return db
    .select()
    .from(files)
    .where(eq(files.userId, safeUserId))
    .orderBy(files.createdAt);
}

/**
 * Get one file only if it belongs to the authenticated user.
 */
export async function getFileForUser(
  fileId: string,
  userId: string
) {
  const db = getDb();

  const safeUserId = normalizeUserId(userId);

  if (!fileId?.trim()) {
    return null;
  }

  const [file] = await db
    .select()
    .from(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, safeUserId)
      )
    )
    .limit(1);

  return file ?? null;
}

/**
 * Get multiple files only when ALL requested files belong to the user.
 *
 * This prevents the caller from accidentally loading another user's file
 * by knowing/guessing a UUID.
 */
export async function getFilesByIds(
  fileIds: string[],
  userId: string
) {
  const db = getDb();

  const safeUserId = normalizeUserId(userId);
  const ids = normalizeFileIds(fileIds);

  if (ids.length === 0) {
    return [];
  }

  return db
    .select()
    .from(files)
    .where(
      and(
        inArray(files.id, ids),
        eq(files.userId, safeUserId)
      )
    );
}

/**
 * Get chunks only for a file owned by the authenticated user.
 */
export async function getFileChunks(
  fileId: string,
  userId: string
) {
  const db = getDb();

  const file = await getFileForUser(fileId, userId);

  if (!file) {
    return [];
  }

  return db
    .select()
    .from(fileChunks)
    .where(eq(fileChunks.fileId, fileId))
    .orderBy(fileChunks.chunkIndex);
}

/**
 * Finds the most relevant chunks across the given files using pgvector's
 * cosine-distance operator.
 *
 * IMPORTANT:
 * The original vector similarity logic is preserved.
 *
 * Ownership is enforced directly inside SQL through the files.user_id
 * relationship, so the caller cannot retrieve another user's chunks.
 */
export async function searchSimilarChunks(
  fileIds: string[],
  queryEmbedding: number[],
  limit = 6,
  userId?: string
) {
  const ids = normalizeFileIds(fileIds);

  if (ids.length === 0) {
    return [];
  }

  if (!Array.isArray(queryEmbedding) || queryEmbedding.length === 0) {
    return [];
  }

  const safeLimit = Math.min(
    Math.max(Number.isFinite(limit) ? Math.floor(limit) : 6, 1),
    20
  );

  const db = getDb();

  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  type Row = {
    id: string;
    file_id: string;
    content: string;
    similarity: number;
  };

  /**
   * If userId is supplied, enforce ownership directly in SQL.
   *
   * The optional fallback exists for internal legacy callers, but all
   * authenticated chat/file flows should pass userId.
   */
  const result = userId?.trim()
    ? await db.execute(sql`
        select
          fc.id,
          fc.file_id,
          fc.content,
          1 - (fc.embedding <=> ${vectorLiteral}::vector) as similarity
        from file_chunks fc
        inner join files f
          on f.id = fc.file_id
        where
          fc.file_id = any(${ids}::uuid[])
          and f.user_id = ${userId.trim()}::uuid
        order by fc.embedding <=> ${vectorLiteral}::vector
        limit ${safeLimit}
      `)
    : await db.execute(sql`
        select
          fc.id,
          fc.file_id,
          fc.content,
          1 - (fc.embedding <=> ${vectorLiteral}::vector) as similarity
        from file_chunks fc
        where fc.file_id = any(${ids}::uuid[])
        order by fc.embedding <=> ${vectorLiteral}::vector
        limit ${safeLimit}
      `);

  const rows = (
    Array.isArray(result)
      ? result
      : (result as { rows?: Row[] }).rows
  ) as Row[] | undefined;

  return rows ?? [];
}

/**
 * Delete a file only when it belongs to the authenticated user.
 */
export async function deleteFileForUser(
  fileId: string,
  userId: string
) {
  const db = getDb();

  const safeUserId = normalizeUserId(userId);

  if (!fileId?.trim()) {
    return false;
  }

  const deleted = await db
    .delete(files)
    .where(
      and(
        eq(files.id, fileId),
        eq(files.userId, safeUserId)
      )
    )
    .returning({
      id: files.id
    });

  return deleted.length > 0;
}

/**
 * Legacy delete helper.
 *
 * Prefer deleteFileForUser() from authenticated routes.
 */
export async function deleteFile(fileId: string) {
  const db = getDb();

  if (!fileId?.trim()) {
    return;
  }

  await db
    .delete(files)
    .where(eq(files.id, fileId));
}
