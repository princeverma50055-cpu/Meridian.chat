import { NextRequest, NextResponse } from 'next/server';
import { getSharedConversation } from '@/lib/db/conversations';

export const runtime = 'nodejs';

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

export async function GET(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{ token: string }>;
  }
) {
  try {
    const { token } = await params;

    const safeToken =
      typeof token === 'string'
        ? token.trim()
        : '';

    /*
     * Current share tokens are generated using
     * crypto.randomBytes(...).toString('base64url'),
     * so they should be sufficiently long.
     */
    if (
      !safeToken ||
      safeToken.length < 20 ||
      safeToken.length > 200
    ) {
      return jsonError(
        'Invalid share link.',
        404
      );
    }

    /*
     * Public endpoint:
     * No login is required because possessing the
     * unguessable share token is the authorization.
     */
    const data =
      await getSharedConversation(
        safeToken
      );

    if (!data) {
      return jsonError(
        'Shared conversation not found or the link has been revoked.',
        404
      );
    }

    /*
     * Do not expose private account information.
     * Return only the conversation and its messages.
     */
    return NextResponse.json(
      {
        conversation: data.conversation,
        messages: data.messages
      },
      {
        headers: {
          'Cache-Control':
            'private, no-store, max-age=0',
          'X-Content-Type-Options':
            'nosniff'
        }
      }
    );
  } catch (err) {
    console.error(
      '[share] failed:',
      err
    );

    return jsonError(
      'Failed to load shared conversation.',
      500
    );
  }
}
