import { NextResponse } from 'next/server';
import { and, eq, ne } from 'drizzle-orm';
import { getServerSession } from 'next-auth';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import { users, authSessions } from '@/lib/db/schema';
import {
  hashPassword,
  verifyPassword
} from '@/lib/auth/password';

export const runtime = 'nodejs';

function json(
  body: Record<string, unknown>,
  status = 200
) {
  return NextResponse.json(body, {
    status,
    headers: {
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    }
  });
}

export async function PATCH(req: Request) {
  try {
    const userId = await getCurrentUserId();

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return json(
        {
          error: 'Invalid JSON request body.'
        },
        400
      );
    }

    if (
      !body ||
      typeof body !== 'object' ||
      Array.isArray(body)
    ) {
      return json(
        {
          error: 'Invalid request body.'
        },
        400
      );
    }

    const input = body as Record<string, unknown>;

    const currentPassword =
      typeof input.currentPassword === 'string'
        ? input.currentPassword
        : '';

    const newPassword =
      typeof input.newPassword === 'string'
        ? input.newPassword
        : '';

    if (!newPassword) {
      return json(
        {
          error: 'New password is required.'
        },
        400
      );
    }

    if (newPassword.length < 8) {
      return json(
        {
          error:
            'New password must be at least 8 characters.'
        },
        400
      );
    }

    if (newPassword.length > 128) {
      return json(
        {
          error:
            'New password must be 128 characters or fewer.'
        },
        400
      );
    }

    const db = getDb();

    const [user] = await db
      .select({
        id: users.id,
        passwordHash: users.passwordHash
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return json(
        {
          error: 'Account not found.'
        },
        404
      );
    }

    /*
     * If the account already has a password,
     * the current password must be verified.
     *
     * If no password exists, this allows a user
     * authenticated through Google/OAuth to create
     * an email/password login password.
     */
    if (user.passwordHash) {
      if (!currentPassword) {
        return json(
          {
            error: 'Current password is required.'
          },
          400
        );
      }

      let validCurrentPassword = false;

      try {
        validCurrentPassword = verifyPassword(
          currentPassword,
          user.passwordHash
        );
      } catch {
        validCurrentPassword = false;
      }

      if (!validCurrentPassword) {
        return json(
          {
            error: 'Current password is incorrect.'
          },
          400
        );
      }

      /*
       * Prevent changing the password to the
       * exact same password.
       */
      try {
        if (
          verifyPassword(
            newPassword,
            user.passwordHash
          )
        ) {
          return json(
            {
              error:
                'New password must be different from your current password.'
            },
            400
          );
        }
      } catch {
        // Invalid legacy hash is handled by the
        // normal password update below.
      }
    }

    const newPasswordHash =
      hashPassword(newPassword);

    await db
      .update(users)
      .set({
        passwordHash: newPasswordHash
      })
      .where(eq(users.id, userId));

    /*
     * Password changes should invalidate other
     * database-backed sessions.
     *
     * Keep the current session alive so the user
     * does not get unexpectedly logged out.
     */
    const session = await getServerSession(
      authOptions
    );

    const currentSessionId = (
      session?.user as
        | { sessionId?: string }
        | undefined
    )?.sessionId;

    if (currentSessionId) {
      await db
        .delete(authSessions)
        .where(
          and(
            eq(authSessions.userId, userId),
            ne(
              authSessions.id,
              currentSessionId
            )
          )
        );
    } else {
      /*
       * Defensive fallback. Normally currentSessionId
       * exists because getCurrentUserId() validated it.
       */
      await db
        .delete(authSessions)
        .where(
          eq(authSessions.userId, userId)
        );
    }

    return json({
      ok: true,
      message:
        'Password updated successfully. Other sessions were signed out.'
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return json(
        {
          error: 'Authentication required.'
        },
        401
      );
    }

    console.error(
      'Password update error:',
      error
    );

    return json(
      {
        error:
          'Failed to update password. Please try again.'
      },
      500
    );
  }
}
