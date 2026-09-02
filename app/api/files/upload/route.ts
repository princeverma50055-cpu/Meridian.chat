import {
  NextRequest,
  NextResponse
} from 'next/server';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import {
  getStorageProvider
} from '@/lib/storage/provider';

import {
  extractText
} from '@/lib/files/extract';

import {
  chunkText
} from '@/lib/files/chunk';

import {
  getEmbeddingsProvider
} from '@/lib/embeddings/provider';

import {
  isAllowedFile,
  MAX_FILE_SIZE_BYTES
} from '@/lib/files/validation';

import {
  createFileRecord,
  insertFileChunks,
  setFileStatus
} from '@/lib/db/files';

import {
  getConversationForUser
} from '@/lib/db/conversations';

export const runtime =
  'nodejs';

function response(
  body: unknown,
  status = 200
) {
  return NextResponse.json(
    body,
    {
      status,
      headers: {
        'Cache-Control':
          'no-store',
        'X-Content-Type-Options':
          'nosniff'
      }
    }
  );
}

function safeFilename(
  filename: string
) {
  const cleaned =
    filename
      .replace(
        /[^a-zA-Z0-9._ -]/g,
        '_'
      )
      .replace(
        /\.{2,}/g,
        '.'
      )
      .trim()
      .slice(0, 180);

  return cleaned || 'upload';
}

export async function POST(
  req: NextRequest
) {
  let userId: string;

  try {
    userId =
      await getCurrentUserId();
  } catch (error) {
    return response(
      {
        error:
          'Authentication required.'
      },
      error instanceof UnauthorizedError
        ? 401
        : 500
    );
  }

  const contentLength =
    Number(
      req.headers.get(
        'content-length'
      ) || 0
    );

  if (
    contentLength >
    MAX_FILE_SIZE_BYTES +
      1024 * 1024
  ) {
    return response(
      {
        error:
          'Upload request is too large.'
      },
      413
    );
  }

  const formData =
    await req
      .formData()
      .catch(() => null);

  if (!formData) {
    return response(
      {
        error:
          'Expected multipart/form-data with a "file" field.'
      },
      400
    );
  }

  const file =
    formData.get('file');

  const conversationId =
    formData.get(
      'conversationId'
    );

  if (!(file instanceof File)) {
    return response(
      {
        error:
          'No file provided.'
      },
      400
    );
  }

  if (
    file.size <= 0
  ) {
    return response(
      {
        error:
          'The uploaded file is empty.'
      },
      400
    );
  }

  if (
    file.size >
    MAX_FILE_SIZE_BYTES
  ) {
    return response(
      {
        error:
          `"${file.name}" exceeds the 20MB limit.`
      },
      413
    );
  }

  if (
    !isAllowedFile(
      file.type,
      file.name
    )
  ) {
    return response(
      {
        error:
          `"${file.name}" has an unsupported file type.`
      },
      415
    );
  }

  let safeConversationId:
    | string
    | undefined;

  if (
    typeof conversationId ===
      'string' &&
    conversationId.trim()
  ) {
    safeConversationId =
      conversationId.trim();

    const conversation =
      await getConversationForUser(
        safeConversationId,
        userId
      );

    if (!conversation) {
      return response(
        {
          error:
            'Conversation not found.'
        },
        404
      );
    }
  }

  const filename =
    safeFilename(file.name);

  const buffer =
    Buffer.from(
      await file.arrayBuffer()
    );

  const mimeType =
    file.type ||
    'application/octet-stream';

  const isImage =
    mimeType.startsWith(
      'image/'
    );

  let fileRecord:
    Awaited<
      ReturnType<
        typeof createFileRecord
      >
    >;

  try {
    const storage =
      getStorageProvider();

    const storagePath =
      await storage.save(
        buffer,
        filename
      );

    fileRecord =
      await createFileRecord({
        userId,
        conversationId:
          safeConversationId,
        fileName: filename,
        mimeType,
        sizeBytes:
          file.size,
        storagePath
      });

    if (!fileRecord) {
      return response(
        {
          error:
            'Failed to create file record.'
        },
        500
      );
    }
  } catch (error) {
    console.error(
      '[files/upload] storage failed:',
      error
    );

    return response(
      {
        error:
          'Failed to store file.'
      },
      500
    );
  }

  if (isImage) {
    await setFileStatus(
      fileRecord.id,
      'ready'
    );

    return response({
      file: {
        ...fileRecord,
        status: 'ready'
      }
    });
  }

  try {
    const {
      text,
      supported
    } = await extractText(
      buffer,
      fileRecord.mimeType,
      filename
    );

    if (!supported) {
      await setFileStatus(
        fileRecord.id,
        'unsupported'
      );

      return response({
        file: {
          ...fileRecord,
          status:
            'unsupported'
        },
        note:
          'File stored, but text extraction is not available for this type yet.'
      });
    }

    if (
      !text.trim()
    ) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No extractable text found in file.'
      );

      return response({
        file: {
          ...fileRecord,
          status: 'error'
        }
      });
    }

    const chunks =
      chunkText(text);

    if (
      chunks.length === 0
    ) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No searchable chunks were created.'
      );

      return response({
        file: {
          ...fileRecord,
          status: 'error'
        }
      });
    }

    let embeddings:
      number[][];

    try {
      const provider =
        getEmbeddingsProvider();

      embeddings =
        await provider.embed(
          chunks
        );
    } catch (error) {
      console.error(
        '[files/upload] embeddings failed:',
        error
      );

      await setFileStatus(
        fileRecord.id,
        'error',
        'Embedding generation failed.'
      );

      return response({
        file: {
          ...fileRecord,
          status: 'error'
        },
        note:
          'File stored, but embeddings failed.'
      });
    }

    const records =
      chunks
        .map(
          (
            content,
            index
          ) => ({
            content,
            embedding:
              embeddings[index]
          })
        )
        .filter(
          (
            item
          ): item is {
            content: string;
            embedding: number[];
          } =>
            Array.isArray(
              item.embedding
            )
        );

    if (
      records.length === 0
    ) {
      await setFileStatus(
        fileRecord.id,
        'error',
        'No valid embeddings were generated.'
      );

      return response({
        file: {
          ...fileRecord,
          status: 'error'
        }
      });
    }

    await insertFileChunks(
      fileRecord.id,
      records
    );

    await setFileStatus(
      fileRecord.id,
      'ready'
    );

    return response({
      file: {
        ...fileRecord,
        status: 'ready'
      }
    });
  } catch (error) {
    console.error(
      '[files/upload] processing failed:',
      error
    );

    await setFileStatus(
      fileRecord.id,
      'error',
      'File processing failed.'
    );

    return response({
      file: {
        ...fileRecord,
        status: 'error'
      }
    });
  }
}
