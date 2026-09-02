import {
  sql,
  eq,
  inArray,
  and
} from 'drizzle-orm';

import {
  getDb
} from '@/lib/db/client';

import {
  files,
  fileChunks
} from '@/lib/db/schema';

function cleanUserId(
  userId: string
) {
  const value =
    userId?.trim();

  if (!value) {
    throw new Error(
      'User ID is required.'
    );
  }

  return value;
}

export async function createFileRecord(
  input: {
    userId: string;
    conversationId?: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    storagePath: string;
  }
) {
  const db = getDb();

  const [row] =
    await db
      .insert(files)
      .values({
        ...input,
        userId:
          cleanUserId(
            input.userId
          ),
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

  await db
    .update(files)
    .set({
      status,
      errorMessage
    })
    .where(
      eq(
        files.id,
        fileId
      )
    );
}

export async function insertFileChunks(
  fileId: string,
  chunks: {
    content: string;
    embedding: number[];
  }[]
) {
  const db = getDb();

  if (chunks.length === 0) {
    return;
  }

  await db
    .insert(fileChunks)
    .values(
      chunks.map(
        (chunk, index) => ({
          fileId,
          chunkIndex: index,
          content:
            chunk.content,
          embedding:
            chunk.embedding
        })
      )
    );
}

export async function listFilesForConversation(
  conversationId: string,
  userId: string
) {
  const db = getDb();

  return db
    .select()
    .from(files)
    .where(
      and(
        eq(
          files.conversationId,
          conversationId
        ),
        eq(
          files.userId,
          cleanUserId(userId)
        )
      )
    );
}

export async function listFilesForUser(
  userId: string
) {
  const db = getDb();

  return db
    .select()
    .from(files)
    .where(
      eq(
        files.userId,
        cleanUserId(userId)
      )
    )
    .orderBy(
      files.createdAt
    )
    .limit(200);
}

export async function searchSimilarChunks(
  fileIds: string[],
  queryEmbedding: number[],
  limit = 6,
  userId: string
) {
  if (
    fileIds.length === 0
  ) {
    return [];
  }

  const db = getDb();

  const safeUserId =
    cleanUserId(userId);

  const safeLimit =
    Math.min(
      Math.max(
        Math.floor(limit),
        1
      ),
      20
    );

  const vectorLiteral =
    `[${queryEmbedding.join(',')}]`;

  type Row = {
    id: string;
    file_id: string;
    content: string;
    similarity: number;
  };

  const result =
    await db.execute(sql`
      select
        fc.id,
        fc.file_id,
        fc.content,
        1 - (
          fc.embedding
          <=> ${vectorLiteral}::vector
        ) as similarity
      from file_chunks fc
      inner join files f
        on f.id = fc.file_id
      where fc.file_id =
        any(${fileIds}::uuid[])
        and f.user_id =
        ${safeUserId}::uuid
      order by
        fc.embedding
        <=> ${vectorLiteral}::vector
      limit ${safeLimit}
    `);

  const rows =
    (
      Array.isArray(result)
        ? result
        : (
            result as {
              rows?: Row[];
            }
          ).rows
    ) as Row[] | undefined;

  return rows ?? [];
}

export async function deleteFile(
  fileId: string,
  userId: string
) {
  const db = getDb();

  await db
    .delete(files)
    .where(
      and(
        eq(
          files.id,
          fileId
        ),
        eq(
          files.userId,
          cleanUserId(userId)
        )
      )
    );
}

export async function getFilesByIds(
  fileIds: string[],
  userId: string
) {
  if (
    fileIds.length === 0
  ) {
    return [];
  }

  const db = getDb();

  return db
    .select()
    .from(files)
    .where(
      and(
        inArray(
          files.id,
          fileIds
        ),
        eq(
          files.userId,
          cleanUserId(userId)
        )
      )
    );
}
