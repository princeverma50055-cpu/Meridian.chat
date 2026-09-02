import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';
import {
  deleteFileForUser,
  getFilesForUser
} from '@/lib/db/files';
import {
  getStorageProvider
} from '@/lib/storage/provider';

export const runtime = 'nodejs';

function unauthorized() {
  return NextResponse.json(
    {
      error: 'UNAUTHORIZED',
      message:
        'Authentication required.'
    },
    {
      status: 401
    }
  );
}

export async function GET(
  request: NextRequest
) {
  let userId: string;

  try {
    userId =
      await getCurrentUserId();
  } catch (error) {
    if (
      error instanceof UnauthorizedError
    ) {
      return unauthorized();
    }

    console.error(
      '[files] Authentication failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'AUTHENTICATION_ERROR',
        message:
          'Unable to verify authentication.'
      },
      {
        status: 500
      }
    );
  }

  try {
    const conversationId =
      request.nextUrl.searchParams
        .get('conversationId')
        ?.trim();

    const userFiles =
      await getFilesForUser(
        userId,
        conversationId || undefined
      );

    return NextResponse.json({
      files: userFiles
    });
  } catch (error) {
    console.error(
      '[files] Failed to load files:',
      error
    );

    return NextResponse.json(
      {
        error: 'FILES_LOAD_FAILED',
        message:
          'Unable to load your files.'
      },
      {
        status: 500
      }
    );
  }
}

export async function DELETE(
  request: NextRequest
) {
  let userId: string;

  try {
    userId =
      await getCurrentUserId();
  } catch (error) {
    if (
      error instanceof UnauthorizedError
    ) {
      return unauthorized();
    }

    console.error(
      '[files] Authentication failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'AUTHENTICATION_ERROR',
        message:
          'Unable to verify authentication.'
      },
      {
        status: 500
      }
    );
  }

  let body: {
    fileId?: unknown;
  };

  try {
    body =
      (await request.json()) as {
        fileId?: unknown;
      };
  } catch {
    return NextResponse.json(
      {
        error: 'INVALID_JSON',
        message:
          'Invalid request body.'
      },
      {
        status: 400
      }
    );
  }

  if (
    typeof body.fileId !==
      'string' ||
    !body.fileId.trim()
  ) {
    return NextResponse.json(
      {
        error: 'INVALID_FILE_ID',
        message:
          'A valid fileId is required.'
      },
      {
        status: 400
      }
    );
  }

  const fileId =
    body.fileId.trim();

  try {
    const deleted =
      await deleteFileForUser(
        fileId,
        userId
      );

    if (!deleted) {
      return NextResponse.json(
        {
          error: 'FILE_NOT_FOUND',
          message:
            'File not found.'
        },
        {
          status: 404
        }
      );
    }

    try {
      const storage =
        getStorageProvider();

      await storage.delete(
        deleted.storagePath
      );
    } catch (storageError) {
      /*
       * Database ownership/deletion has already
       * succeeded. Log storage cleanup failure
       * instead of exposing internal storage details.
       */
      console.error(
        '[files] Storage cleanup failed:',
        storageError
      );
    }

    return NextResponse.json({
      success: true,
      fileId: deleted.id
    });
  } catch (error) {
    console.error(
      '[files] File deletion failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'FILE_DELETE_FAILED',
        message:
          'Unable to delete file.'
      },
      {
        status: 500
      }
    );
  }
}
