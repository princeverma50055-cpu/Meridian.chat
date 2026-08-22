import { NextRequest, NextResponse } from 'next/server';
import { getConversationMessages, renameConversation, deleteConversation } from '@/lib/db/conversations';

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const rows = await getConversationMessages(params.id);
    return NextResponse.json({ messages: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load conversation' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json();
    if (typeof body.title !== 'string' || !body.title.trim()) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }
    await renameConversation(params.id, body.title.trim());
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to rename conversation' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await deleteConversation(params.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete conversation' },
      { status: 500 }
    );
  }
}
