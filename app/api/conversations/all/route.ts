import { NextResponse } from 'next/server';

import { deleteAllConversations } from '@/lib/db/conversations';

import {
  isUnauthorizedError,
  requireUserId
} from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

export async function DELETE() {
  try {
    const userId = await requireUserId();

    await deleteAllConversations(userId);

    return NextResponse.json(
      {
        ok: true
      },
      {
        headers
      }
    );
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: error.message
        },
        {
          status: 401,
          headers
        }
      );
    }

    console.error(
      '[conversations/all] DELETE failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        message:
          'Unable to delete conversations right now. Please try again in a moment.'
      },
      {
        status: 500,
        headers
      }
    );
  }
}
