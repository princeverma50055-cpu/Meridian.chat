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

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'Conversation id is required' },
        { status: 400 }
      );
    }

    const conversation = await getConversationForUser(id, userId);

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const messages = await getConversationMessages(id, userId);

    return NextResponse.json(
      {
        conversation,
        messages: messages ?? []
      },
      {
        headers: {
          'Cache-Control': 'private, no-store'
        }
      }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.error('Conversation GET error:', error);

    return NextResponse.json(
      { error: 'Failed to load conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: RouteContext
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'Conversation id is required' },
        { status: 400 }
      );
    }

    const current = await getConversationForUser(id, userId);

    if (!current) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    const body = await req.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    if (body.share === true) {
      const updated = await createShareToken(userId, id);

      return NextResponse.json({
        ok: true,
        shared: true,
        conversation: updated,
        shareUrl: updated?.[0]?.shareToken
          ? `/share/${updated[0].shareToken}`
          : null
      });
    }

    if (body.share === false) {
      const updated = await revokeShareToken(userId, id);

      return NextResponse.json({
        ok: true,
        shared: false,
        conversation: updated
      });
    }

    const patch: {
      title?: string;
      pinned?: boolean;
      archived?: boolean;
    } = {};

    if (body.title !== undefined) {
      if (typeof body.title !== 'string') {
        return NextResponse.json(
          { error: 'title must be a string' },
          { status: 400 }
        );
      }

      const title = body.title.trim();

      if (!title) {
        return NextResponse.json(
          { error: 'title is required' },
          { status: 400 }
        );
      }

      patch.title = title.slice(0, 120);
    }

    if (body.pinned !== undefined) {
      if (typeof body.pinned !== 'boolean') {
        return NextResponse.json(
          { error: 'pinned must be a boolean' },
          { status: 400 }
        );
      }

      patch.pinned = body.pinned;
    }

    if (body.archived !== undefined) {
      if (typeof body.archived !== 'boolean') {
        return NextResponse.json(
          { error: 'archived must be a boolean' },
          { status: 400 }
        );
      }

      patch.archived = body.archived;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    const updated = await updateConversation(
      userId,
      id,
      patch
    );

    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      ok: true,
      conversation: updated
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.error('Conversation PATCH error:', error);

    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const userId = await getCurrentUserId();
    const { id } = await params;

    if (!id?.trim()) {
      return NextResponse.json(
        { error: 'Conversation id is required' },
        { status: 400 }
      );
    }

    const current = await getConversationForUser(id, userId);

    if (!current) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    await deleteConversation(userId, id);

    return NextResponse.json({
      ok: true
    });
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    console.error('Conversation DELETE error:', error);

    return NextResponse.json(
      { error: 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
