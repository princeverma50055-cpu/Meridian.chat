import { NextRequest, NextResponse } from 'next/server';
import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';
import { searchUserChats } from '@/lib/db/account';

export const runtime = 'nodejs';

const MAX_QUERY_LENGTH = 200;

function jsonError(message: string, status: number) {
  return NextResponse.json(
    { error: message },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    }
  );
}

export async function GET(req: NextRequest) {
  let userId: string;

  try {
    userId = await getCurrentUserId();
  } catch (err) {
    return jsonError(
      'Authentication required.',
      err instanceof UnauthorizedError ? 401 : 500
    );
  }

  const query =
    req.nextUrl.searchParams
      .get('q')
      ?.trim() ?? '';

  if (!query) {
    return NextResponse.json(
      { conversations: [] },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  }

  if (query.length > MAX_QUERY_LENGTH) {
    return jsonError(
      `Search query cannot exceed ${MAX_QUERY_LENGTH} characters.`,
      400
    );
  }

  try {
    /*
     * searchUserChats must always receive the authenticated
     * user's ID. This prevents cross-user chat discovery.
     */
    const conversations =
      await searchUserChats(
        userId,
        query
      );

    return NextResponse.json(
      { conversations },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (err) {
    console.error(
      '[conversation-search] failed:',
      err
    );

    return jsonError(
      'Failed to search conversations.',
      500
    );
  }
}
