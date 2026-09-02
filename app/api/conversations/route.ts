import {
  NextRequest,
  NextResponse
} from 'next/server';

import {
  createConversation,
  listConversations
} from '@/lib/db/conversations';

import {
  isUnauthorizedError,
  requireUserId
} from '@/lib/auth/requireUser';

import {
  validateConversationTitle,
  validatePagination,
  ValidationError
} from '@/lib/security/validation';

export const runtime =
  'nodejs';

export const dynamic =
  'force-dynamic';

const headers = {
  'Cache-Control':
    'no-store',
  'X-Content-Type-Options':
    'nosniff'
};

export async function GET(
  req: NextRequest
) {
  try {
    const userId =
      await requireUserId();

    const url =
      new URL(req.url);

    const {
      page,
      pageSize
    } =
      validatePagination(
        url.searchParams.get(
          'page'
        ),
        url.searchParams.get(
          'pageSize'
        )
      );

    const all =
      await listConversations(
        userId
      );

    const offset =
      (page - 1) *
      pageSize;

    const conversations =
      all.slice(
        offset,
        offset + pageSize
      );

    return NextResponse.json(
      {
        ok: true,
        conversations,
        page,
        pageSize,
        hasMore:
          offset + pageSize <
          all.length
      },
      {
        headers
      }
    );
  } catch (error) {
    if (
      isUnauthorizedError(
        error
      )
    ) {
      return NextResponse.json(
        {
          error:
            'UNAUTHORIZED',
          message:
            error.message
        },
        {
          status: 401,
          headers
        }
      );
    }

    if (
      error instanceof
      ValidationError
    ) {
      return NextResponse.json(
        {
          error:
            'VALIDATION_ERROR',
          message:
            error.message
        },
        {
          status: 400,
          headers
        }
      );
    }

    console.error(
      '[conversations] GET failed:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to load conversations.'
      },
      {
        status: 500,
        headers
      }
    );
  }
}

export async function POST(
  req: NextRequest
) {
  try {
    const userId =
      await requireUserId();

    const body =
      (await req
        .json()
        .catch(() => ({}))) as {
        title?: unknown;
      };

    const title =
      body.title === undefined
        ? 'New chat'
        : validateConversationTitle(
            body.title
          );

    const conversation =
      await createConversation(
        userId,
        title
      );

    return NextResponse.json(
      {
        ok: true,
        conversation
      },
      {
        status: 201,
        headers
      }
    );
  } catch (error) {
    if (
      isUnauthorizedError(
        error
      )
    ) {
      return NextResponse.json(
        {
          error:
            'UNAUTHORIZED',
          message:
            error.message
        },
        {
          status: 401,
          headers
        }
      );
    }

    if (
      error instanceof
      ValidationError
    ) {
      return NextResponse.json(
        {
          error:
            'VALIDATION_ERROR',
          message:
            error.message
        },
        {
          status: 400,
          headers
        }
      );
    }

    console.error(
      '[conversations] POST failed:',
      error
    );

    return NextResponse.json(
      {
        error:
          'Failed to create conversation.'
      },
      {
        status: 500,
        headers
      }
    );
  }
}
