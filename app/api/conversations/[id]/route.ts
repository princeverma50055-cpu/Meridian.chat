import { NextRequest, NextResponse } from 'next/server';
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

async function getAuthorizedConversation(
  id: string,
  userId: string
) {
  if (!id?.trim()) {
    return null;
  }

  return getConversationForUser(
    id.trim(),
    userId
  );
}

export async function GET(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const userId =
      await getCurrentUserId();

    const { id } = await params;

    const conversation =
      await getAuthorizedConversation(
        id,
        userId
      );

    if (!conversation) {
      return jsonError(
        'Conversation not found.',
        404
      );
    }

    /*
     * IMPORTANT:
     * Pass userId here too so messages cannot be
     * read merely by knowing a conversation ID.
     */
    const messages =
      await getConversationMessages(
        id,
        userId
      );

    if (!messages) {
      return jsonError(
        'Conversation not found.',
        404
      );
    }

    return NextResponse.json(
      {
        conversation,
        messages
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (err) {
    console.error(
      '[conversation] GET failed:',
      err
    );

    return jsonError(
      err instanceof Error
        ? err.message
        : 'Failed to load conversation.',
      err instanceof UnauthorizedError
        ? 401
        : 500
    );
  }
}

export async function PATCH(
  req: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const userId =
      await getCurrentUserId();

    const { id } = await params;

    const conversation =
      await getAuthorizedConversation(
        id,
        userId
      );

    if (!conversation) {
      return jsonError(
        'Conversation not found.',
        404
      );
    }

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return jsonError(
        'Invalid JSON request body.',
        400
      );
    }

    if (
      !body ||
      typeof body !== 'object'
    ) {
      return jsonError(
        'Invalid request body.',
        400
      );
    }

    const input =
      body as Record<string, unknown>;

    /*
     * Sharing is handled separately because it creates
     * or revokes a server-generated secret token.
     */
    if (input.share === true) {
      const updated =
        await createShareToken(
          userId,
          id
        );

      if (!updated?.length) {
        return jsonError(
          'Failed to create share link.',
          500
        );
      }

      return NextResponse.json(
        {
          ok: true,
          conversation: updated[0]
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    if (input.share === false) {
      const updated =
        await revokeShareToken(
          userId,
          id
        );

      if (!updated?.length) {
        return jsonError(
          'Failed to revoke share link.',
          500
        );
      }

      return NextResponse.json(
        {
          ok: true,
          conversation: updated[0]
        },
        {
          headers: {
            'Cache-Control': 'no-store',
            'X-Content-Type-Options': 'nosniff'
          }
        }
      );
    }

    const patch: {
      title?: string;
      pinned?: boolean;
      archived?: boolean;
    } = {};

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        'title'
      )
    ) {
      if (
        typeof input.title !== 'string'
      ) {
        return jsonError(
          'title must be a string.',
          400
        );
      }

      const title =
        input.title.trim();

      if (!title) {
        return jsonError(
          'title cannot be empty.',
          400
        );
      }

      if (title.length > 120) {
        return jsonError(
          'title cannot exceed 120 characters.',
          400
        );
      }

      patch.title = title;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        'pinned'
      )
    ) {
      if (
        typeof input.pinned !== 'boolean'
      ) {
        return jsonError(
          'pinned must be a boolean.',
          400
        );
      }

      patch.pinned =
        input.pinned;
    }

    if (
      Object.prototype.hasOwnProperty.call(
        input,
        'archived'
      )
    ) {
      if (
        typeof input.archived !== 'boolean'
      ) {
        return jsonError(
          'archived must be a boolean.',
          400
        );
      }

      patch.archived =
        input.archived;
    }

    if (
      Object.keys(patch).length === 0
    ) {
      return jsonError(
        'No valid conversation changes were provided.',
        400
      );
    }

    const updated =
      await updateConversation(
        userId,
        id,
        patch
      );

    if (!updated?.length) {
      return jsonError(
        'Conversation not found.',
        404
      );
    }

    return NextResponse.json(
      {
        ok: true,
        conversation: updated[0]
      },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (err) {
    console.error(
      '[conversation] PATCH failed:',
      err
    );

    return jsonError(
      err instanceof Error
        ? err.message
        : 'Failed to update conversation.',
      err instanceof UnauthorizedError
        ? 401
        : 500
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  {
    params
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const userId =
      await getCurrentUserId();

    const { id } = await params;

    const conversation =
      await getAuthorizedConversation(
        id,
        userId
      );

    if (!conversation) {
      return jsonError(
        'Conversation not found.',
        404
      );
    }

    await deleteConversation(
      userId,
      id
    );

    return NextResponse.json(
      { ok: true },
      {
        headers: {
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (err) {
    console.error(
      '[conversation] DELETE failed:',
      err
    );

    return jsonError(
      err instanceof Error
        ? err.message
        : 'Failed to delete conversation.',
      err instanceof UnauthorizedError
        ? 401
        : 500
    );
  }
}
