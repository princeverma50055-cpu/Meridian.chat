import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import { getDb } from '@/lib/db/client';
import {
  users,
  files,
  authSessions
} from '@/lib/db/schema';

import { getStorageProvider } from '@/lib/storage/provider';

export const runtime = 'nodejs';

export async function DELETE() {
  try {
    const userId = await getCurrentUserId();

    const db = getDb();

    /*
     * 1. Collect all user-owned files first.
     *
     * The database row will be deleted later, so we need the
     * storage paths before the DB cascade removes the file rows.
     */
    const userFiles = await db
      .select({
        storagePath: files.storagePath
      })
      .from(files)
      .where(eq(files.userId, userId));

    /*
     * 2. Delete user files from external storage.
     *
     * Storage cleanup is best-effort. If one object is already
     * missing, account deletion should still continue.
     */
    const storage = getStorageProvider();

    await Promise.all(
      userFiles.map(async (file) => {
        if (!file.storagePath?.trim()) {
          return;
        }

        try {
          await storage.delete(file.storagePath);
        } catch (error) {
          console.error(
            'Account deletion: failed to delete storage object:',
            file.storagePath,
            error
          );
        }
      })
    );

    /*
     * 3. Revoke ALL authentication sessions.
     *
     * This is important because deleting the account should
     * immediately invalidate every active login session.
     */
    await db
      .delete(authSessions)
      .where(eq(authSessions.userId, userId));

    /*
     * 4. Delete the user.
     *
     * Related records using ON DELETE CASCADE will be removed
     * by PostgreSQL, including profiles, conversations,
     * messages/files that cascade through their relationships,
     * memories, etc., according to the database schema.
     */
    const deleted = await db
      .delete(users)
      .where(eq(users.id, userId))
      .returning({
        id: users.id
      });

    if (deleted.length === 0) {
      return NextResponse.json(
        {
          error: 'Account not found'
        },
        {
          status: 404,
          headers: {
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    return NextResponse.json(
      {
        ok: true
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          error: 'Authentication required'
        },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    console.error(
      'Account deletion error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to delete account'
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
