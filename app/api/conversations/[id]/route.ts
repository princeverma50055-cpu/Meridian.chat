import {
  NextRequest,
  NextResponse
} from 'next/server';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import {
  getConversationMessages,
  getConversationForUser,
  updateConversation,
  deleteConversation,
  createShareToken,
  revokeShareToken
} from '@/lib/db/conversations';

function headers() {
  return {
    'Cache-Control':
      'no-store',
    'X-Content-Type-Options':
      'nosniff'
  };
}

export async function GET(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const userId =
      await getCurrentUserId();

    const { id } =
      await params;

    const conversation =
      await getConversationForUser(
        id,
        userId
      );

    if (!conversation) {
      return NextResponse.json(
        {
          error:
            'Conversation not found'
        },
        {
          status: 404,
          headers: headers()
        }
      );
    }

    const messages =
      await getConversationMessages(
        id,
        userId
      );

    return NextResponse.json(
      {
        conversation,
        messages:
          messages ?? []
      },
      {
        status: 200,
        headers: headers()
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to load conversation.'
      },
      {
        status:
          error instanceof UnauthorizedError
            ? 401
            : 500,
        headers: headers()
      }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const userId =
      await getCurrentUserId();

    const { id } =
      await params;

    const current =
      await getConversationForUser(
        id,
        userId
      );

    if (!current) {
      return NextResponse.json(
        {
          error:
            'Conversation not found'
        },
        {
          status: 404,
          headers: headers()
        }
      );
    }

    const body =
      await req.json()
        .catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        {
          error:
            'Invalid request body.'
        },
        {
          status: 400,
          headers: headers()
        }
      );
    }

    if (
      body.share === true
    ) {
      const updated =
        await createShareToken(
          userId,
          id
        );

      return NextResponse.json(
        {
          ok: true,
          conversation: updated
        },
        {
          status: 200,
          headers: headers()
        }
      );
    }

    if (
      body.share === false
    ) {
      const updated =
        await revokeShareToken(
          userId,
          id
        );

      return NextResponse.json(
        {
          ok: true,
          conversation: updated
        },
        {
          status: 200,
          headers: headers()
        }
      );
    }

    const patch: {
      title?: string;
      pinned?: boolean;
      archived?: boolean;
    } = {};

    if (
      body.title !== undefined
    ) {
      if (
        typeof body.title !==
          'string' ||
        !body.title.trim()
      ) {
        return NextResponse.json(
          {
            error:
              'title is required.'
          },
          {
            status: 400,
            headers: headers()
          }
        );
      }

      patch.title =
        body.title
          .trim()
          .slice(0, 120);
    }

    if (
      body.pinned !== undefined
    ) {
      if (
        typeof body.pinned !==
        'boolean'
      ) {
        return NextResponse.json(
          {
            error:
              'pinned must be boolean.'
          },
          {
            status: 400,
            headers: headers()
          }
        );
      }

      patch.pinned =
        body.pinned;
    }

    if (
      body.archived !== undefined
    ) {
      if (
        typeof body.archived !==
        'boolean'
      ) {
        return NextResponse.json(
          {
            error:
              'archived must be boolean.'
          },
          {
            status: 400,
            headers: headers()
          }
        );
      }

      patch.archived =
        body.archived;
    }

    if (
      Object.keys(patch)
        .length === 0
    ) {
      return NextResponse.json(
        {
          error:
            'No supported fields provided.'
        },
        {
          status: 400,
          headers: headers()
        }
      );
    }

    const updated =
      await updateConversation(
        userId,
        id,
        patch
      );

    return NextResponse.json(
      {
        ok: true,
        conversation: updated
      },
      {
        status: 200,
        headers: headers()
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to update conversation.'
      },
      {
        status:
          error instanceof UnauthorizedError
            ? 401
            : 500,
        headers: headers()
      }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{
      id: string;
    }>;
  }
) {
  try {
    const userId =
      await getCurrentUserId();

    const { id } =
      await params;

    const current =
      await getConversationForUser(
        id,
        userId
      );

    if (!current) {
      return NextResponse.json(
        {
          error:
            'Conversation not found'
        },
        {
          status: 404,
          headers: headers()
        }
      );
    }

    await deleteConversation(
      userId,
      id
    );

    return NextResponse.json(
      {
        ok: true
      },
      {
        status: 200,
        headers: headers()
      }
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Failed to delete conversation.'
      },
      {
        status:
          error instanceof UnauthorizedError
            ? 401
            : 500,
        headers: headers()
      }
    );
  }
}
