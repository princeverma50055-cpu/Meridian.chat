import {
  NextResponse
} from 'next/server';

import {
  eq,
  and,
  gt,
  desc
} from 'drizzle-orm';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import {
  getDb
} from '@/lib/db/client';

import {
  authSessions
} from '@/lib/db/schema';

import {
  getServerSession
} from 'next-auth';

import {
  authOptions
} from '@/lib/auth/config';

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

export async function GET() {
  try {
    const userId =
      await getCurrentUserId();

    const session =
      await getServerSession(
        authOptions
      );

    const currentSessionId =
      (
        session?.user as
          | {
              sessionId?: string;
            }
          | undefined
      )?.sessionId;

    const db =
      getDb();

    /*
     * Remove expired sessions belonging
     * to this user before returning the list.
     */
    await db
      .delete(authSessions)
      .where(
        and(
          eq(
            authSessions.userId,
            userId
          ),
          gt(
            new Date(),
            authSessions.expiresAt
          )
        )
      );

    /*
     * Return only non-expired sessions
     * belonging to the authenticated user.
     */
    const rows =
      await db
        .select({
          id:
            authSessions.id,

          userAgent:
            authSessions.userAgent,

          ipAddress:
            authSessions.ipAddress,

          createdAt:
            authSessions.createdAt,

          lastSeenAt:
            authSessions.lastSeenAt,

          expiresAt:
            authSessions.expiresAt
        })
        .from(authSessions)
        .where(
          and(
            eq(
              authSessions.userId,
              userId
            ),
            gt(
              authSessions.expiresAt,
              new Date()
            )
          )
        )
        .orderBy(
          desc(
            authSessions.lastSeenAt
          )
        );

    return NextResponse.json(
      {
        sessions:
          rows.map(
            (row) => ({
              id: row.id,

              userAgent:
                row.userAgent,

              /*
               * IP is included only for the
               * authenticated account owner.
               */
              ipAddress:
                row.ipAddress,

              createdAt:
                row.createdAt,

              lastSeenAt:
                row.lastSeenAt,

              expiresAt:
                row.expiresAt,

              current:
                row.id ===
                currentSessionId
            })
          )
      },
      {
        status: 200,
        headers: {
          'Cache-Control':
            'private, no-store, max-age=0',
          'X-Content-Type-Options':
            'nosniff'
        }
      }
    );
  } catch (error) {
    console.error(
      '[security/sessions] failed:',
      error
    );

    return jsonError(
      error instanceof Error &&
        error.message
          .toLowerCase()
          .includes(
            'session'
          )
        ? error.message
        : 'Authentication required.',
      error instanceof UnauthorizedError
        ? 401
        : 500
    );
  }
}
