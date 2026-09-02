import { NextResponse } from 'next/server';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import {
  getDb
} from '@/lib/db/client';

import {
  users,
  files
} from '@/lib/db/schema';

import {
  eq
} from 'drizzle-orm';

import {
  getStorageProvider
} from '@/lib/storage/provider';

export const runtime = 'nodejs';

function jsonError(
  message: string,
  status: number
) {
  return NextResponse.json(
    {
      error: message
    },
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

export async function DELETE() {
  let userId: string;

  try {
    userId =
      await getCurrentUserId();
  } catch (error) {
    return jsonError(
      'Authentication required.',
      error instanceof UnauthorizedError
        ? 401
        : 500
    );
  }

  try {
    const db =
      getDb();

    /*
     * Only files belonging to the
     * authenticated user are selected.
     */
    const userFiles =
      await db
        .select({
          id: files.id,
          storagePath:
            files.storagePath
        })
        .from(files)
        .where(
          eq(
            files.userId,
            userId
          )
        );

    /*
     * Remove physical storage objects.
     *
     * Storage deletion failures are logged,
     * but should not prevent database cleanup.
     */
    try {
      const storage =
        getStorageProvider();

      await Promise.all(
        userFiles.map(
          async (file) => {
            if (
              !file.storagePath
            ) {
              return;
            }

            try {
              await storage.delete(
                file.storagePath
              );
            } catch (error) {
              console.error(
                '[account/delete] storage deletion failed:',
                {
                  fileId:
                    file.id,
                  error
                }
              );
            }
          }
        )
      );
    } catch (error) {
      /*
       * Storage provider itself may not be
       * available. Database deletion should
       * still continue.
       */
      console.error(
        '[account/delete] storage provider unavailable:',
        error
      );
    }

    /*
     * Deleting the user triggers ON DELETE CASCADE
     * for user-owned relational data where the
     * schema defines the relationship.
     */
    const deleted =
      await db
        .delete(users)
        .where(
          eq(
            users.id,
            userId
          )
        )
        .returning({
          id: users.id
        });

    if (
      deleted.length === 0
    ) {
      return jsonError(
        'Account not found.',
        404
      );
    }

    return NextResponse.json(
      {
        ok: true
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'no-store',
          'X-Content-Type-Options':
            'nosniff'
        }
      }
    );
  } catch (error) {
    console.error(
      '[account/delete] failed:',
      error
    );

    return jsonError(
      error instanceof Error
        ? error.message
        : 'Failed to delete account.',
      500
    );
  }
}
