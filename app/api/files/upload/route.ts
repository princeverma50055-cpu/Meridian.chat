import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { getStorageProvider } from '@/lib/storage/provider';
import { extractText } from '@/lib/files/extract';
import { chunkText } from '@/lib/files/chunk';
import { getEmbeddingsProvider } from '@/lib/embeddings/provider';
import { isAllowedFile, MAX_FILE_SIZE_BYTES } from '@/lib/files/validation';
import {
  createFileRecord,
  insertFileChunks,
  setFileStatus,
} from '@/lib/db/files';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);

  if (!formData) {
    return NextResponse.json(
      {
        error:
          'Expected multipart/form-data with a "file" field',
      },
      { status: 400 }
    );
  }

  const file = formData.get('file');
  const conversationId = formData.get('conversationId');

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'No file provided' },
      { status: 400 }
    );
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(
          1
        )}MB, which exceeds the 20MB limit.`,
      },
      { status: 413 }
    );
  }

  if (!isAllowedFile(file.type, file.name)) {
    return NextResponse.json(
      {
        error: `"${file.name}" has an unsupported file type (${
          file.type || 'unknown'
        }).`,
      },
      { status: 415 }
    );
  }

  const userId = await getCurrentUserId();
  const buffer = Buffer.from(await file.arrayBuffer());

  let fileRecord;

  try {
    const storage = getStorageProvider();
    const storagePath = await storage.save(buffer, file.name);

    fileRecord = await createFileRecord({
      userId,
      conversationId:
        typeof conversationId === 'string'
          ? conversationId
          : undefined,
      fileName: file.name,
      mimeType: file.type || 'application/octet-stream',
      sizeBytes: file.size,
      storagePath,
    });

    if (!fileRecord) {
      return NextResponse.json(
        { error: 'Failed to create file record' },
        { status: 500 }
      );
    }
  } catch (err) {
    return NextResponse.json(
      {
        error:
          err instanceof Error
            ? err.message
            : 'Failed to store file',
      },
      { status: 500 }
    );
  }

  // Extraction and embedding happen after the file record exists.
  // The file record is created first so the upload can safely track
  // processing status.

  try {
    const { text, supported } = await extractText(
      buffer,
      fileRecord.mimeType,
      file.name
    );

    if (!supported) {
      await setFileStatus(fileRecord.id, 'unsupported');

      return NextResponse.json({
        file: {
          ...fileRecord,
          status: 'unsupported',
        },
        note:
          "File stored, but text extraction/RAG isn't implemented for this type yet.",
      });
    }

    if (!text.trim()) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No extractable text found in file'
      );

      return NextResponse.json({
        file: {
          ...fileRecord,
          status: 'error',
        },
      });
    }

    const chunks = chunkText(text);

    let embeddings: number[][];

    try {
      const embeddingsProvider = getEmbeddingsProvider();

      embeddings = await embeddingsProvider.embed(chunks);
    } catch (err) {
      // File is stored and readable, but embeddings failed.
      // Don't fail the whole upload.

      await setFileStatus(
        fileRecord.id,
        'error',
        err instanceof Error
          ? err.message
          : 'Embedding failed'
      );

      return NextResponse.json({
        file: {
          ...fileRecord,
          status: 'error',
        },
        note:
          "File stored, but embeddings failed — it won't be searchable until this is resolved.",
      });
    }

    // Build only chunks that have a valid embedding.
    // This explicitly guarantees that embedding is number[]
    // instead of number[] | undefined.

    const fileChunks: {
      content: string;
      embedding: number[];
    }[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const content = chunks[i];
      const embedding = embeddings[i];

      if (!content || !embedding) {
        continue;
      }

      fileChunks.push({
        content,
        embedding,
      });
    }

    // If no chunks received embeddings, mark processing as failed.
    if (fileChunks.length === 0) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No valid embeddings were generated for the file'
      );

      return NextResponse.json({
        file: {
          ...fileRecord,
          status: 'error',
        },
        note:
          'File was stored, but no valid embeddings were generated.',
      });
    }

    await insertFileChunks(
      fileRecord.id,
      fileChunks
    );

    await setFileStatus(
      fileRecord.id,
      'ready'
    );

    return NextResponse.json({
      file: {
        ...fileRecord,
        status: 'ready',
      },
    });
  } catch (err) {
    await setFileStatus(
      fileRecord.id,
      'error',
      err instanceof Error
        ? err.message
        : 'Processing failed'
    );

    return NextResponse.json({
      file: {
        ...fileRecord,
        status: 'error',
      },
    });
  }
}
