import { NextResponse } from 'next/server';
import {
  and,
  eq
} from 'drizzle-orm';

import {
  getCurrentUser,
  UnauthorizedError
} from '@/lib/auth/currentUser';

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
    const user =
      await getCurrentUser();

    const { id } =
      await context.params;

    const sessionId =
      id?.trim();

    if (!sessionId) {
      return NextResponse.json(
        {
          error:
            'Invalid session ID'
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store'
          }
        }
      );
    }

    /*
     * Never allow the current session
     * to be revoked through this endpoint.
     */
    if (
      sessionId ===
      user.sessionId
    ) {
      return NextResponse.json(
        {
          error:
            'You cannot revoke the current session here. Use Log out instead.'
        },
        {
          status: 400,
          headers: {
            'Cache-Control':
              'no-store',
            'X-Content-Type-Options':
              'nosniff'
          }
        }
      );
    }

    const db = getDb();

    const deleted =
      await db
        .delete(authSessions)
        .where(
          and(
            eq(
              authSessions.id,
              sessionId
            ),
            eq(
              authSessions.userId,
              user.id
            )
          )
        )
        .returning({
          id: authSessions.id
        });

    const revokedSession =
      deleted[0];

    if (!revokedSession) {
      return NextResponse.json(
        {
          error:
            'Session not found'
        },
        {
          status: 404,
          headers: {
            'Cache-Control':
              'no-store',
            'X-Content-Type-Options':
              'nosniff'
          }
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        revokedSessionId:
          revokedSession.id
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
    if (
      error instanceof UnauthorizedError
    ) {
      return NextResponse.json(
        {
          error:
            'Authentication required'
        },
        {
          status: 401,
          headers: {
            'Cache-Control':
              'no-store'
          }
        }
      );
    }

    console.error(
      '[sessions] Failed to revoke session:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to revoke session'
      },
      {
        status: 500,
        headers: {
          'Cache-Control':
            'no-store'
        }
      }
    );
  }
}
