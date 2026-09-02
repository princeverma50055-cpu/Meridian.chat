import {
  eq,
  desc,
  and
} from 'drizzle-orm';

import {
  getDb
} from '@/lib/db/client';

import {
  conversations,
  messages,
  messageRoleEnum
} from '@/lib/db/schema';

import {
  randomBytes
} from 'node:crypto';

type MessageRole =
  (typeof messageRoleEnum.enumValues)[number];

function cleanUserId(
  userId: string
) {
  const value =
    userId?.trim();

  if (!value) {
    throw new Error(
      'User ID is required.'
    );
  }

  return value;
}

function cleanConversationId(
  conversationId: string
) {
  const value =
    conversationId?.trim();

  if (!value) {
    throw new Error(
      'Conversation ID is required.'
    );
  }

  return value;
}

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
        eq(
          conversations.userId,
          cleanUserId(userId)
        ),
        eq(
          conversations.archived,
          false
        )
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

  const cleanTitle =
    title
      .trim()
      .slice(0, 120) ||
    'New chat';

  const [row] =
    await db
      .insert(conversations)
      .values({
        userId:
          cleanUserId(userId),
        title: cleanTitle
      })
      .returning();

  return row;
}

export async function getConversationForUser(
  conversationId: string,
  userId: string
) {
  const db = getDb();

  const [row] =
    await db
      .select()
      .from(conversations)
      .where(
        and(
          eq(
            conversations.id,
            cleanConversationId(
              conversationId
            )
          ),
          eq(
            conversations.userId,
            cleanUserId(userId)
          )
        )
      )
      .limit(1);

  return row;
}

export async function getConversationMessages(
  conversationId: string,
  userId: string
) {
  const db = getDb();

  const id =
    cleanConversationId(
      conversationId
    );

  const owner =
    cleanUserId(userId);

  const conversation =
    await getConversationForUser(
      id,
      owner
    );

  if (!conversation) {
    return null;
  }

  return db
    .select()
    .from(messages)
    .where(
      eq(
        messages.conversationId,
        id
      )
    )
    .orderBy(
      messages.createdAt
    );
}

export async function addMessage(
  conversationId: string,
  role: MessageRole,
  content: string,
  model?: string
) {
  const db = getDb();

  const id =
    cleanConversationId(
      conversationId
    );

  const [row] =
    await db
      .insert(messages)
      .values({
        conversationId: id,
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
        id
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
  const db = getDb();

  const safePatch = {
    ...patch
  };

  if (
    safePatch.title !==
    undefined
  ) {
    safePatch.title =
      safePatch.title
        .trim()
        .slice(0, 120);
  }

  const [row] =
    await db
      .update(conversations)
      .set({
        ...safePatch,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(
            conversations.id,
            cleanConversationId(
              conversationId
            )
          ),
          eq(
            conversations.userId,
            cleanUserId(userId)
          )
        )
      )
      .returning();

  return row;
}

export async function renameConversation(
  userId: string,
  conversationId: string,
  title: string
) {
  return updateConversation(
    userId,
    conversationId,
    {
      title
    }
  );
}

export async function deleteConversation(
  userId: string,
  conversationId: string
) {
  const db = getDb();

  await db
    .delete(conversations)
    .where(
      and(
        eq(
          conversations.id,
          cleanConversationId(
            conversationId
          )
        ),
        eq(
          conversations.userId,
          cleanUserId(userId)
        )
      )
    );
}

export async function deleteAllConversations(
  userId: string
) {
  const db = getDb();

  await db
    .delete(conversations)
    .where(
      eq(
        conversations.userId,
        cleanUserId(userId)
      )
    );
}

export async function createShareToken(
  userId: string,
  conversationId: string
) {
  const token =
    randomBytes(32)
      .toString('base64url');

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
  const db = getDb();

  const safeToken =
    token?.trim();

  if (
    !safeToken ||
    safeToken.length < 20 ||
    safeToken.length > 200
  ) {
    return null;
  }

  const [conversation] =
    await db
      .select()
      .from(conversations)
      .where(
        eq(
          conversations.shareToken,
          safeToken
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
      .orderBy(
        messages.createdAt
      );

  return {
    conversation,
    messages: rows
  };
}

export function deriveTitle(
  firstUserMessage: string
) {
  const trimmed =
    firstUserMessage
      .trim()
      .replace(/\s+/g, ' ');

  return trimmed.length > 48
    ? `${trimmed.slice(0, 48)}…`
    : trimmed ||
        'New chat';
}
