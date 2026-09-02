import { NextResponse } from 'next/server';
import {
  and,
  desc,
  eq,
  gt,
  lt
} from 'drizzle-orm';

import {
  getCurrentUser,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import { getDb } from '@/lib/db/client';
import { authSessions } from '@/lib/db/schema';

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
    const user =
      await getCurrentUser();

    const db = getDb();

    /*
     * Remove expired sessions belonging
     * only to the authenticated user.
     */
    await db
      .delete(authSessions)
      .where(
        and(
          eq(
            authSessions.userId,
            user.id
          ),
          lt(
            authSessions.expiresAt,
            new Date()
          )
        )
      );

    /*
     * Return active sessions only.
     */
    const rows =
      await db
        .select({
          id: authSessions.id,
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
              user.id
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
          rows.map((row) => ({
            id: row.id,
            userAgent:
              row.userAgent,
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
              user.sessionId
          }))
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
    if (
      error instanceof UnauthorizedError
    ) {
      return jsonError(
        'Authentication required',
        401
      );
    }

    console.error(
      '[sessions] Failed to list sessions:',
      error
    );

    return jsonError(
      'Failed to load sessions',
      500
    );
  }
}
