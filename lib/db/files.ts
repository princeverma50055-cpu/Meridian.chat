import { and, desc, eq, inArray } from 'drizzle-orm';
import {
  fileChunks,
  files
} from '@/lib/db/schema';
import { getDb } from '@/lib/db/client';

export async function getFilesByIds(
  fileIds: string[],
  userId?: string
) {
  const ids = [
    ...new Set(
      fileIds
        .filter(
          (id): id is string =>
            typeof id === 'string'
        )
        .map((id) => id.trim())
        .filter(Boolean)
    )
  ];

  if (
    ids.length === 0 ||
    (userId !== undefined &&
      !userId.trim())
  ) {
    return [];
  }

  const db = getDb();

  const conditions = [
    inArray(files.id, ids)
  ];

  if (userId) {
    conditions.push(
      eq(files.userId, userId)
    );
  }

  return db
    .select()
    .from(files)
    .where(and(...conditions));
}

export async function getFileForUser(
  fileId: string,
  userId: string
) {
  if (
    !fileId?.trim() ||
    !userId?.trim()
  ) {
    return null;
  }

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

  return file ?? null;
}

export async function getFilesForUser(
  userId: string,
  conversationId?: string
) {
  if (!userId?.trim()) {
    return [];
  }

  const db = getDb();

  const conditions = [
    eq(files.userId, userId)
  ];

  if (conversationId?.trim()) {
    conditions.push(
      eq(
        files.conversationId,
        conversationId
      )
    );
  }

  return db
    .select()
    .from(files)
    .where(and(...conditions))
    .orderBy(
      desc(files.createdAt)
    );
}

export async function getFileChunks(
  fileId: string,
  userId: string
) {
  const file =
    await getFileForUser(
      fileId,
      userId
    );

  if (!file) {
    return [];
  }

  const db = getDb();

  return db
    .select()
    .from(fileChunks)
    .where(
      eq(
        fileChunks.fileId,
        fileId
      )
    )
    .orderBy(
      fileChunks.chunkIndex
    );
}

export async function searchSimilarChunks(
  fileIds: string[],
  embedding: number[],
  limit = 6,
  userId?: string
) {
  if (
    fileIds.length === 0 ||
    embedding.length === 0
  ) {
    return [];
  }

  const accessibleFiles =
    await getFilesByIds(
      fileIds,
      userId
    );

  if (
    accessibleFiles.length === 0
  ) {
    return [];
  }

  const accessibleFileIds =
    accessibleFiles.map(
      (file) => file.id
    );

  const db = getDb();

  /*
   * The actual vector similarity query can vary
   * depending on the PostgreSQL/pgvector schema.
   * Keep the ownership filter here so only chunks
   * belonging to authorized files are considered.
   */
  const rows =
    await db
      .select({
        id: fileChunks.id,
        file_id:
          fileChunks.fileId,
        content:
          fileChunks.content,
        chunk_index:
          fileChunks.chunkIndex
      })
      .from(fileChunks)
      .where(
        inArray(
          fileChunks.fileId,
          accessibleFileIds
        )
      )
      .limit(
        Math.max(1, Math.min(limit, 20))
      );

  return rows;
}

export async function createFileRecord(
  userId: string,
  values: {
    fileName: string;
    mimeType: string;
    size: number;
    storagePath: string;
    conversationId?: string | null;
  }
) {
  if (!userId?.trim()) {
    throw new Error(
      'User ID is required.'
    );
  }

  const db = getDb();

  const [file] = await db
    .insert(files)
    .values({
      userId,
      fileName:
        values.fileName.trim(),
      mimeType:
        values.mimeType.trim(),
      size: values.size,
      storagePath:
        values.storagePath,
      conversationId:
        values.conversationId ??
        null
    })
    .returning();

  return file;
}

export async function deleteFileForUser(
  fileId: string,
  userId: string
) {
  if (
    !fileId?.trim() ||
    !userId?.trim()
  ) {
    return false;
  }

  const db = getDb();

  const deleted =
    await db
      .delete(files)
      .where(
        and(
          eq(files.id, fileId),
          eq(files.userId, userId)
        )
      )
      .returning({
        id: files.id,
        storagePath:
          files.storagePath
      });

  return deleted[0] ?? null;
}
