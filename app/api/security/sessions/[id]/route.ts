import { NextResponse } from 'next/server';
import { and, eq, gt } from 'drizzle-orm';
import { getServerSession } from 'next-auth';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';
import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import { authSessions } from '@/lib/db/schema';

export const runtime = 'nodejs';

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(
  _request: Request,
  context: RouteContext
) {
  try {
    const userId = await getCurrentUserId();

    const { id } = await context.params;

    if (!id || !id.trim()) {
      return NextResponse.json(
        {
          error: 'Invalid session ID'
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const session = await getServerSession(authOptions);

    const currentSessionId = (
      session?.user as
        | { sessionId?: string }
        | undefined
    )?.sessionId;

    // Never allow the current session to be revoked
    // through this endpoint.
    if (id === currentSessionId) {
      return NextResponse.json(
        {
          error:
            'You cannot revoke the current session here. Use Log out instead.'
        },
        {
          status: 400,
          headers: {
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    const db = getDb();

    const deleted = await db
      .delete(authSessions)
      .where(
        and(
          eq(authSessions.id, id),
          eq(authSessions.userId, userId)
        )
      )
      .returning({
        id: authSessions.id
      });

    if (deleted.length === 0) {
      return NextResponse.json(
        {
          error: 'Session not found'
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
        ok: true,
        revokedSessionId: deleted[0].id
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
      'Session revoke error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to revoke session'
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
