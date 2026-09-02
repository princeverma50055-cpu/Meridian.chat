import { NextRequest, NextResponse } from 'next/server';
import { getSharedConversation } from '@/lib/db/conversations';

type RouteContext = {
  params: Promise<{ token: string }>;
};

const SHARE_TOKEN_REGEX = /^[A-Za-z0-9_-]{20,100}$/;

export async function GET(
  _req: NextRequest,
  { params }: RouteContext
) {
  try {
    const { token } = await params;

    if (!token || !SHARE_TOKEN_REGEX.test(token)) {
      return NextResponse.json(
        { error: 'Invalid share link' },
        { status: 400 }
      );
    }

    const data = await getSharedConversation(token);

    if (!data) {
      return NextResponse.json(
        { error: 'Shared conversation not found' },
        { status: 404 }
      );
    }

    const messages = data.messages
      .filter((message) => message.role !== 'system')
      .map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content,
        model: message.model,
        createdAt: message.createdAt
      }));

    return NextResponse.json(
      {
        conversation: {
          id: data.conversation.id,
          title: data.conversation.title,
          createdAt: data.conversation.createdAt,
          updatedAt: data.conversation.updatedAt
        },
        messages
      },
      {
        headers: {
          'Cache-Control': 'public, max-age=60, s-maxage=60',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (error) {
    console.error('Shared conversation error:', error);

    return NextResponse.json(
      { error: 'Failed to load shared conversation' },
      { status: 500 }
    );
  }
}
