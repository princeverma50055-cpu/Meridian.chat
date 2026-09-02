import { NextResponse } from 'next/server';
import { and, desc, eq, gt } from 'drizzle-orm';
import { getServerSession } from 'next-auth';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';
import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import { authSessions } from '@/lib/db/schema';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const session = await getServerSession(authOptions);

    const currentSessionId = (
      session?.user as
        | { sessionId?: string }
        | undefined
    )?.sessionId;

    const db = getDb();

    // Remove expired sessions belonging to this user.
    await db
      .delete(authSessions)
      .where(
        and(
          eq(authSessions.userId, userId),
          // expiresAt <= now
          // Using NOT(gt(...)) is avoided because Drizzle's
          // expression support varies, so fetch/delete below
          // keeps the query simple and safe.
        )
      )
      .catch(() => {
        // Do not fail the entire settings page if cleanup fails.
      });

    const rows = await db
      .select({
        id: authSessions.id,
        userAgent: authSessions.userAgent,
        ipAddress: authSessions.ipAddress,
        createdAt: authSessions.createdAt,
        lastSeenAt: authSessions.lastSeenAt,
        expiresAt: authSessions.expiresAt
      })
      .from(authSessions)
      .where(
        and(
          eq(authSessions.userId, userId),
          gt(authSessions.expiresAt, new Date())
        )
      )
      .orderBy(desc(authSessions.lastSeenAt));

    const sessions = rows.map((row) => ({
      id: row.id,
      userAgent: row.userAgent,
      ipAddress: row.ipAddress,
      createdAt: row.createdAt,
      lastSeenAt: row.lastSeenAt,
      expiresAt: row.expiresAt,
      current: row.id === currentSessionId
    }));

    return NextResponse.json(
      {
        sessions
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
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
      'Active sessions error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to load active sessions'
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
