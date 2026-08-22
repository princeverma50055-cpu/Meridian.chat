import { eq, desc, and } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { conversations, messages, messageRoleEnum } from '@/lib/db/schema';

type MessageRole = (typeof messageRoleEnum.enumValues)[number];

export async function listConversations(userId: string) {
  const db = getDb();
  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      pinned: conversations.pinned,
      updatedAt: conversations.updatedAt
    })
    .from(conversations)
    .where(and(eq(conversations.userId, userId), eq(conversations.archived, false)))
    .orderBy(desc(conversations.updatedAt))
    .limit(50);
}

export async function createConversation(userId: string, title = 'New chat') {
  const db = getDb();
  const [row] = await db.insert(conversations).values({ userId, title }).returning();
  return row;
}

export async function getConversationMessages(conversationId: string) {
  const db = getDb();
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt);
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  model?: string
) {
  const db = getDb();
  const [row] = await db
    .insert(messages)
    .values({ conversationId, role, content, model })
    .returning();

  await db
    .update(conversations)
    .set({ updatedAt: new Date() })
    .where(eq(conversations.id, conversationId));

  return row;
}

export async function renameConversation(conversationId: string, title: string) {
  const db = getDb();
  await db.update(conversations).set({ title }).where(eq(conversations.id, conversationId));
}

export async function deleteConversation(conversationId: string) {
  const db = getDb();
  await db.delete(conversations).where(eq(conversations.id, conversationId));
}

/** Derives a short title from the first user message, mirroring the UX spec's auto-title behavior. */
export function deriveTitle(firstUserMessage: string): string {
  const trimmed = firstUserMessage.trim().replace(/\s+/g, ' ');
  return trimmed.length > 48 ? `${trimmed.slice(0, 48)}…` : trimmed || 'New chat';
}
