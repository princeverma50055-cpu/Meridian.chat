import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import {
  getCurrentUser,
  UnauthorizedError
} from '@/lib/auth/currentUser';
import { getDb } from '@/lib/db/client';
import { authSessions } from '@/lib/db/schema';

export const runtime = 'nodejs';

export async function POST() {
  try {
    const user =
      await getCurrentUser();

    const db = getDb();

    await db
      .delete(authSessions)
      .where(
        eq(
          authSessions.id,
          user.sessionId
        )
      );

    return NextResponse.json({
      success: true,
      message:
        'Session revoked successfully.'
    });
  } catch (error) {
    if (
      error instanceof UnauthorizedError
    ) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message:
            error.message
        },
        {
          status: 401
        }
      );
    }

    console.error(
      '[auth/logout] Logout failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'LOGOUT_FAILED',
        message:
          'Unable to log out. Please try again.'
      },
      {
        status: 500
      }
    );
  }
}
