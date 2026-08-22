import { sql, eq, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { files, fileChunks } from '@/lib/db/schema';

export async function createFileRecord(input: {
  userId: string;
  conversationId?: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
}) {
  const db = getDb();
  const [row] = await db
    .insert(files)
    .values({ ...input, status: 'processing' })
    .returning();
  return row;
}

export async function setFileStatus(fileId: string, status: string, errorMessage?: string) {
  const db = getDb();
  await db.update(files).set({ status, errorMessage }).where(eq(files.id, fileId));
}

export async function insertFileChunks(
  fileId: string,
  chunks: { content: string; embedding: number[] }[]
) {
  const db = getDb();
  if (chunks.length === 0) return;
  await db.insert(fileChunks).values(
    chunks.map((c, i) => ({
      fileId,
      chunkIndex: i,
      content: c.content,
      embedding: c.embedding
    }))
  );
}

export async function listFilesForConversation(conversationId: string) {
  const db = getDb();
  return db.select().from(files).where(eq(files.conversationId, conversationId));
}

export async function listFilesForUser(userId: string) {
  const db = getDb();
  return db.select().from(files).where(eq(files.userId, userId)).orderBy(files.createdAt);
}

/**
 * Finds the most relevant chunks across the given files for a query
 * embedding, using pgvector's cosine-distance operator. Raw SQL because
 * Drizzle's query builder doesn't yet expose vector operators directly.
 */
export async function searchSimilarChunks(
  fileIds: string[],
  queryEmbedding: number[],
  limit = 6
) {
  if (fileIds.length === 0) return [];
  const db = getDb();
  const vectorLiteral = `[${queryEmbedding.join(',')}]`;

  type Row = { id: string; file_id: string; content: string; similarity: number };

  const result = await db.execute(sql`
    select fc.id, fc.file_id, fc.content, 1 - (fc.embedding <=> ${vectorLiteral}::vector) as similarity
    from file_chunks fc
    where fc.file_id = any(${fileIds}::uuid[])
    order by fc.embedding <=> ${vectorLiteral}::vector
    limit ${limit}
  `);

  // postgres-js returns rows directly as an array-like; cast defensively
  // since the exact wrapper shape has varied slightly across drizzle-orm
  // versions (some return { rows }, others the array itself).
  const rows = (Array.isArray(result) ? result : (result as { rows?: Row[] }).rows) as
    | Row[]
    | undefined;

  return rows ?? [];
}

export async function deleteFile(fileId: string) {
  const db = getDb();
  await db.delete(files).where(eq(files.id, fileId));
}

export async function getFilesByIds(fileIds: string[]) {
  if (fileIds.length === 0) return [];
  const db = getDb();
  return db.select().from(files).where(inArray(files.id, fileIds));
}
