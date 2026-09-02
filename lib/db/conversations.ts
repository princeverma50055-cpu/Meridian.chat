import { and, desc, eq } from 'drizzle-orm';
import { randomBytes } from 'node:crypto';
import {
  getDb
} from '@/lib/db/client';
import {
  conversations,
  messages,
  messageRoleEnum
} from '@/lib/db/schema';

type MessageRole =
  (typeof messageRoleEnum.enumValues)[number];

export async function listConversations(
  userId: string
) {
  const db = getDb();

  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      pinned: conversations.pinned,
      archived: conversations.archived,
      updatedAt: conversations.updatedAt
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        eq(conversations.archived, false)
      )
    )
    .orderBy(
      desc(conversations.pinned),
      desc(conversations.updatedAt)
    )
    .limit(100);
}

export async function createConversation(
  userId: string,
  title = 'New chat'
) {
  const db = getDb();

  const [row] = await db
    .insert(conversations)
    .values({
      userId,
      title
    })
    .returning();

  return row;
}

export async function getConversationForUser(
  conversationId: string,
  userId: string
) {
  if (!conversationId || !userId) {
    return null;
  }

  const db = getDb();

  const [row] = await db
    .select()
    .from(conversations)
    .where(
      and(
        eq(
          conversations.id,
          conversationId
        ),
        eq(
          conversations.userId,
          userId
        )
      )
    )
    .limit(1);

  return row ?? null;
}

export async function getConversationMessages(
  conversationId: string,
  userId: string
) {
  if (!conversationId || !userId) {
    return null;
  }

  const conversation =
    await getConversationForUser(
      conversationId,
      userId
    );

  if (!conversation) {
    return null;
  }

  const db = getDb();

  return db
    .select()
    .from(messages)
    .where(
      eq(
        messages.conversationId,
        conversationId
      )
    )
    .orderBy(messages.createdAt);
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  model?: string
) {
  if (!conversationId) {
    throw new Error(
      'Conversation ID is required.'
    );
  }

  if (!content.trim()) {
    throw new Error(
      'Message content cannot be empty.'
    );
  }

  const db = getDb();

  const [row] = await db
    .insert(messages)
    .values({
      conversationId,
      role,
      content,
      model
    })
    .returning();

  await db
    .update(conversations)
    .set({
      updatedAt: new Date()
    })
    .where(
      eq(
        conversations.id,
        conversationId
      )
    );

  return row;
}

export async function updateConversation(
  userId: string,
  conversationId: string,
  patch: {
    title?: string;
    pinned?: boolean;
    archived?: boolean;
    shareToken?: string | null;
  }
) {
  if (!userId || !conversationId) {
    return null;
  }

  const db = getDb();

  const [row] = await db
    .update(conversations)
    .set({
      ...patch,
      updatedAt: new Date()
    })
    .where(
      and(
        eq(
          conversations.id,
          conversationId
        ),
        eq(
          conversations.userId,
          userId
        )
      )
    )
    .returning();

  return row ?? null;
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string
) {
  const cleanTitle =
    title.trim();

  if (!cleanTitle) {
    return null;
  }

  return updateConversation(
    userId,
    conversationId,
    {
      title: cleanTitle
    }
  );
}

export async function deleteConversation(
  userId: string,
  conversationId: string
) {
  if (!userId || !conversationId) {
    return false;
  }

  const db = getDb();

  const deleted =
    await db
      .delete(conversations)
      .where(
        and(
          eq(
            conversations.id,
            conversationId
          ),
          eq(
            conversations.userId,
            userId
          )
        )
      )
      .returning({
        id: conversations.id
      });

  return deleted.length > 0;
}

export async function deleteAllConversations(
  userId: string
) {
  if (!userId) {
    return;
  }

  const db = getDb();

  await db
    .delete(conversations)
    .where(
      eq(
        conversations.userId,
        userId
      )
    );
}

export async function createShareToken(
  userId: string,
  conversationId: string
) {
  const token =
    randomBytes(32).toString(
      'base64url'
    );

  return updateConversation(
    userId,
    conversationId,
    {
      shareToken: token
    }
  );
}

export async function revokeShareToken(
  userId: string,
  conversationId: string
) {
  return updateConversation(
    userId,
    conversationId,
    {
      shareToken: null
    }
  );
}

export async function getSharedConversation(
  token: string
) {
  const cleanToken =
    token.trim();

  if (!cleanToken) {
    return null;
  }

  const db = getDb();

  const [conversation] =
    await db
      .select()
      .from(conversations)
      .where(
        eq(
          conversations.shareToken,
          cleanToken
        )
      )
      .limit(1);

  if (!conversation) {
    return null;
  }

  const rows =
    await db
      .select()
      .from(messages)
      .where(
        eq(
          messages.conversationId,
          conversation.id
        )
      )
      .orderBy(messages.createdAt);

  return {
    conversation,
    messages: rows
  };
}

export function deriveTitle(
  firstUserMessage: string
): string {
  const trimmed =
    firstUserMessage
      .trim()
      .replace(/\s+/g, ' ');

  return trimmed.length > 48
    ? `${trimmed.slice(0, 48)}…`
    : trimmed || 'New chat';
}
