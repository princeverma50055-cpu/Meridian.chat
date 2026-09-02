import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';
import { getStorageProvider } from '@/lib/storage/provider';
import { extractText } from '@/lib/files/extract';
import { chunkText } from '@/lib/files/chunk';
import { getEmbeddingsProvider } from '@/lib/embeddings/provider';
import {
  isAllowedFile,
  MAX_FILE_SIZE_BYTES
} from '@/lib/files/validation';
import {
  createFileRecord,
  insertFileChunks,
  setFileStatus
} from '@/lib/db/files';
import { getConversationForUser } from '@/lib/db/conversations';

export const runtime = 'nodejs';

const MAX_FILENAME_LENGTH = 255;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}

function sanitizeFileName(name: string) {
  return name
    .replace(/[\u0000-\u001F\u007F]/g, '')
    .replace(/[\\/]/g, '_')
    .trim()
    .slice(0, MAX_FILENAME_LENGTH);
}

export async function POST(req: NextRequest) {
  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (err) {
    return jsonError(
      'Authentication required.',
      err instanceof UnauthorizedError ? 401 : 500
    );
  }

  const formData = await req.formData().catch(() => null);

  if (!formData) {
    return jsonError(
      'Expected multipart/form-data with a "file" field.',
      400
    );
  }

  const file = formData.get('file');
  const conversationValue = formData.get('conversationId');

  if (!(file instanceof File)) {
    return jsonError('No file provided.', 400);
  }

  const conversationId =
    typeof conversationValue === 'string'
      ? conversationValue.trim()
      : '';

  const fileName = sanitizeFileName(file.name);

  if (!fileName) {
    return jsonError('Invalid file name.', 400);
  }

  if (file.size <= 0) {
    return jsonError('The uploaded file is empty.', 400);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    return jsonError(
      `"${fileName}" exceeds the 20MB file size limit.`,
      413
    );
  }

  if (!isAllowedFile(file.type, fileName)) {
    return jsonError(
      `"${fileName}" has an unsupported file type (${file.type || 'unknown'}).`,
      415
    );
  }

  /*
   * Conversation authorization:
   * A user may only attach a file to their own conversation.
   */
  if (conversationId) {
    try {
      const conversation = await getConversationForUser(
        conversationId,
        userId
      );

      if (!conversation) {
        return jsonError(
          'Conversation not found.',
          404
        );
      }
    } catch (err) {
      console.error(
        '[files/upload] conversation authorization failed:',
        err
      );

      return jsonError(
        'Failed to verify conversation.',
        500
      );
    }
  }

  const buffer = Buffer.from(
    await file.arrayBuffer()
  );

  const mimeType =
    file.type || 'application/octet-stream';

  const isImage =
    mimeType.startsWith('image/');

  let fileRecord;

  try {
    const storage = getStorageProvider();

    /*
     * Storage provider is responsible for generating
     * a safe storage key/path. Never use user input
     * directly as a filesystem/storage path.
     */
    const storagePath = await storage.save(
      buffer,
      fileName
    );

    fileRecord = await createFileRecord({
      userId,
      conversationId: conversationId || undefined,
      fileName,
      mimeType,
      sizeBytes: file.size,
      storagePath
    });

    if (!fileRecord) {
      console.error(
        '[files/upload] file record was not created'
      );

      return jsonError(
        'Failed to create file record.',
        500
      );
    }
  } catch (err) {
    console.error(
      '[files/upload] storage/database failed:',
      err
    );

    return jsonError(
      err instanceof Error
        ? err.message
        : 'Failed to store file.',
      500
    );
  }

  /*
   * Images are passed to the AI as vision input.
   * They do not need text extraction or embeddings.
   */
  if (isImage) {
    try {
      await setFileStatus(
        fileRecord.id,
        'ready'
      );

      return NextResponse.json(
        {
          file: {
            ...fileRecord,
            status: 'ready'
          }
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    } catch (err) {
      console.error(
        '[files/upload] image status update failed:',
        err
      );

      return jsonError(
        'File was uploaded but could not be finalized.',
        500
      );
    }
  }

  try {
    const {
      text,
      supported
    } = await extractText(
      buffer,
      fileRecord.mimeType,
      fileName
    );

    if (!supported) {
      await setFileStatus(
        fileRecord.id,
        'unsupported'
      );

      return NextResponse.json(
        {
          file: {
            ...fileRecord,
            status: 'unsupported'
          },
          note:
            'File stored, but text extraction/RAG is not implemented for this file type yet.'
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    if (!text || !text.trim()) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No extractable text found in file.'
      );

      return NextResponse.json(
        {
          file: {
            ...fileRecord,
            status: 'error'
          }
        },
        {
          status: 422,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    const chunks = chunkText(text);

    if (!chunks.length) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No usable text chunks were generated.'
      );

      return NextResponse.json(
        {
          file: {
            ...fileRecord,
            status: 'error'
          }
        },
        {
          status: 422,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    let embeddings: number[][];

    try {
      const embeddingsProvider =
        getEmbeddingsProvider();

      embeddings =
        await embeddingsProvider.embed(
          chunks
        );
    } catch (err) {
      console.error(
        '[files/upload] embeddings failed:',
        err
      );

      await setFileStatus(
        fileRecord.id,
        'error',
        err instanceof Error
          ? err.message.slice(0, 1000)
          : 'Embedding failed.'
      );

      return NextResponse.json(
        {
          file: {
            ...fileRecord,
            status: 'error'
          },
          note:
            'File stored, but embeddings failed.'
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    const chunkRows = chunks
      .map((content, index) => ({
        content,
        embedding: embeddings[index]
      }))
      .filter(
        (
          item
        ): item is {
          content: string;
          embedding: number[];
        } =>
          Array.isArray(item.embedding) &&
          item.embedding.length > 0
      );

    if (!chunkRows.length) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No valid embeddings were generated.'
      );

      return NextResponse.json(
        {
          file: {
            ...fileRecord,
            status: 'error'
          }
        },
        {
          status: 500,
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    await insertFileChunks(
      fileRecord.id,
      chunkRows
    );

    await setFileStatus(
      fileRecord.id,
      'ready'
    );

    return NextResponse.json(
      {
        file: {
          ...fileRecord,
          status: 'ready'
        }
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (err) {
    console.error(
      '[files/upload] processing failed:',
      err
    );

    try {
      await setFileStatus(
        fileRecord.id,
        'error',
        err instanceof Error
          ? err.message.slice(0, 1000)
          : 'File processing failed.'
      );
    } catch (statusError) {
      console.error(
        '[files/upload] failed to update error status:',
        statusError
      );
    }

    return jsonError(
      err instanceof Error
        ? err.message
        : 'File processing failed.',
      500
    );
  }
}
