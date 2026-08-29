import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { getStorageProvider } from '@/lib/storage/provider';
import { extractText } from '@/lib/files/extract';
import { chunkText } from '@/lib/files/chunk';
import { getEmbeddingsProvider } from '@/lib/embeddings/provider';
import { isAllowedFile, MAX_FILE_SIZE_BYTES } from '@/lib/files/validation';
import { createFileRecord, insertFileChunks, setFileStatus } from '@/lib/db/files';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: 'Expected multipart/form-data with a "file" field' }, { status: 400 });
  }

  const file = formData.get('file');
  const conversationId = formData.get('conversationId');

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json(
      { error: `"${file.name}" is ${(file.size / 1024 / 1024).toFixed(1)}MB, which exceeds the 20MB limit.` },
      { status: 413 }
    );
  }

  if (!isAllowedFile(file.type, file.name)) {
    return NextResponse.json(
      { error: `"${file.name}" has an unsupported file type (${file.type || 'unknown'}).` },
      { status: 415 }
    );
  }

  const userId = await getCurrentUserId();
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || 'application/octet-stream';
  const isImage = mimeType.startsWith('image/');

  let fileRecord;
  try {
    const storage = getStorageProvider();
    const storagePath = await storage.save(buffer, file.name);

    fileRecord = await createFileRecord({
      userId,
      conversationId: typeof conversationId === 'string' ? conversationId : undefined,
      fileName: file.name,
      mimeType,
      sizeBytes: file.size,
      storagePath
    });

    if (!fileRecord) {
      console.error('[files/upload] createFileRecord returned no row');
      return NextResponse.json({ error: 'Failed to create file record' }, { status: 500 });
    }
  } catch (err) {
    console.error('[files/upload] storage/db step failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to store file' },
      { status: 500 }
    );
  }

  // Images are shown directly to the model as vision input, not chunked/embedded —
  // just mark them ready immediately.
  if (isImage) {
    await setFileStatus(fileRecord.id, 'ready');
    return NextResponse.json({ file: { ...fileRecord, status: 'ready' } });
  }

  try {
    const { text, supported } = await extractText(buffer, fileRecord.mimeType, file.name);

    if (!supported) {
      await setFileStatus(fileRecord.id, 'unsupported');
      return NextResponse.json({
        file: { ...fileRecord, status: 'unsupported' },
        note: 'File stored, but text extraction/RAG isn\'t implemented for this type yet.'
      });
    }

    if (!text.trim()) {
      await setFileStatus(fileRecord.id, 'error', 'No extractable text found in file');
      return NextResponse.json({ file: { ...fileRecord, status: 'error' } });
    }

    const chunks = chunkText(text);

    let embeddings: number[][];
    try {
      const embeddingsProvider = getEmbeddingsProvider();
      embeddings = await embeddingsProvider.embed(chunks);
    } catch (err) {
      console.error('[files/upload] embeddings failed:', err);
      await setFileStatus(fileRecord.id, 'error', err instanceof Error ? err.message : 'Embedding failed');
      return NextResponse.json({
        file: { ...fileRecord, status: 'error' },
        note: 'File stored, but embeddings failed — it won\'t be searchable until this is resolved.'
      });
    }

    await insertFileChunks(
      fileRecord.id,
      chunks
        .map((content, i) => ({ content, embedding: embeddings[i] }))
        .filter((c): c is { content: string; embedding: number[] } => c.embedding !== undefined)
    );
    await setFileStatus(fileRecord.id, 'ready');

    return NextResponse.json({ file: { ...fileRecord, status: 'ready' } });
  } catch (err) {
    console.error('[files/upload] extraction/processing failed:', err);
    await setFileStatus(fileRecord.id, 'error', err instanceof Error ? err.message : 'Processing failed');
    return NextResponse.json({ file: { ...fileRecord, status: 'error' } });
  }
}
