import {
  eq,
  and,
  ilike,
  or,
  desc
} from 'drizzle-orm';

import { getDb } from '@/lib/db/client';

import {
  users,
  profiles,
  conversations,
  messages,
  files,
  memories
} from '@/lib/db/schema';

function normalizeUserId(userId: string) {
  const value = userId?.trim();

  if (!value) {
    throw new Error('User ID is required.');
  }

  return value;
}

/* -------------------------------------------------------------------------- */
/* PROFILE                                                                    */
/* -------------------------------------------------------------------------- */

export async function getProfile(
  userId: string
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt
    })
    .from(users)
    .where(
      eq(users.id, safeUserId)
    )
    .limit(1);

  if (!user) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(
      eq(profiles.userId, safeUserId)
    )
    .limit(1);

  return {
    user,
    profile:
      profile ?? {
        userId: safeUserId,
        plan: 'free',
        preferences: {}
      }
  };
}

export async function updateProfile(
  userId: string,
  input: {
    name?: string;
    preferences?: Record<
      string,
      unknown
    >;
  }
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  if (
    input.name !== undefined
  ) {
    const name =
      typeof input.name === 'string'
        ? input.name.trim().slice(0, 80)
        : '';

    await db
      .update(users)
      .set({
        name: name || null
      })
      .where(
        eq(users.id, safeUserId)
      );
  }

  if (
    input.preferences !== undefined
  ) {
    const [current] =
      await db
        .select()
        .from(profiles)
        .where(
          eq(
            profiles.userId,
            safeUserId
          )
        )
        .limit(1);

    const previous =
      current?.preferences &&
      typeof current.preferences ===
        'object'
        ? current.preferences as Record<
            string,
            unknown
          >
        : {};

    const merged = {
      ...previous,
      ...input.preferences
    };

    if (current) {
      await db
        .update(profiles)
        .set({
          preferences: merged,
          updatedAt: new Date()
        })
        .where(
          eq(
            profiles.userId,
            safeUserId
          )
        );
    } else {
      await db
        .insert(profiles)
        .values({
          userId: safeUserId,
          preferences: merged
        });
    }
  }

  return getProfile(
    safeUserId
  );
}

/* -------------------------------------------------------------------------- */
/* MEMORIES                                                                   */
/* -------------------------------------------------------------------------- */

export async function addMemory(
  userId: string,
  content: string
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  if (
    typeof content !== 'string'
  ) {
    throw new Error(
      'Memory content must be a string.'
    );
  }

  const cleaned =
    content
      .replace(/\u0000/g, '')
      .trim();

  if (!cleaned) {
    throw new Error(
      'Memory content is required.'
    );
  }

  if (cleaned.length > 1000) {
    throw new Error(
      'Memory cannot exceed 1,000 characters.'
    );
  }

  /*
   * Avoid creating the exact same memory
   * repeatedly for the same account.
   */
  const [existing] =
    await db
      .select()
      .from(memories)
      .where(
        and(
          eq(
            memories.userId,
            safeUserId
          ),
          eq(
            memories.content,
            cleaned
          )
        )
      )
      .limit(1);

  if (existing) {
    return existing;
  }

  const [row] =
    await db
      .insert(memories)
      .values({
        userId: safeUserId,
        content: cleaned
      })
      .returning();

  return row;
}

export async function getMemories(
  userId: string
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  return db
    .select()
    .from(memories)
    .where(
      eq(
        memories.userId,
        safeUserId
      )
    )
    .orderBy(
      desc(memories.createdAt)
    )
    .limit(500);
}

export async function deleteMemory(
  userId: string,
  id: string
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  if (!id?.trim()) {
    return false;
  }

  const deleted =
    await db
      .delete(memories)
      .where(
        and(
          eq(
            memories.id,
            id.trim()
          ),
          eq(
            memories.userId,
            safeUserId
          )
        )
      )
      .returning({
        id: memories.id
      });

  return deleted.length > 0;
}

export async function deleteAllMemories(
  userId: string
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  await db
    .delete(memories)
    .where(
      eq(
        memories.userId,
        safeUserId
      )
    );
}

/* -------------------------------------------------------------------------- */
/* CHAT SEARCH                                                                */
/* -------------------------------------------------------------------------- */

export async function searchUserChats(
  userId: string,
  q: string
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  const query =
    typeof q === 'string'
      ? q.trim().slice(0, 200)
      : '';

  if (!query) {
    return [];
  }

  /*
   * Escape LIKE wildcard characters so the
   * user cannot turn the search into an
   * unrestricted wildcard query.
   */
  const escaped =
    query
      .replace(/\\/g, '\\\\')
      .replace(/%/g, '\\%')
      .replace(/_/g, '\\_');

  const term =
    `%${escaped}%`;

  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt:
        conversations.updatedAt,
      pinned:
        conversations.pinned,
      archived:
        conversations.archived
    })
    .from(conversations)
    .where(
      and(
        eq(
          conversations.userId,
          safeUserId
        ),
        or(
          ilike(
            conversations.title,
            term
          )
        )
      )
    )
    .orderBy(
      desc(
        conversations.updatedAt
      )
    )
    .limit(50);
}

/* -------------------------------------------------------------------------- */
/* ACCOUNT EXPORT                                                             */
/* -------------------------------------------------------------------------- */

export async function exportUserData(
  userId: string
) {
  const db = getDb();

  const safeUserId =
    normalizeUserId(userId);

  const profile =
    await getProfile(
      safeUserId
    );

  if (!profile) {
    throw new Error(
      'Account not found.'
    );
  }

  const chats =
    await db
      .select()
      .from(conversations)
      .where(
        eq(
          conversations.userId,
          safeUserId
        )
      )
      .orderBy(
        desc(
          conversations.createdAt
        )
      );

  const chatIds =
    chats.map(
      (chat) => chat.id
    );

  let msgs: typeof messages.$inferSelect[] =
    [];

  if (chatIds.length > 0) {
    const conditions =
      chatIds.map(
        (id) =>
          eq(
            messages.conversationId,
            id
          )
      );

    msgs =
      await db
        .select()
        .from(messages)
        .where(
          or(...conditions)
        )
        .orderBy(
          messages.createdAt
        );
  }

  const userFiles =
    await db
      .select({
        id: files.id,
        fileName:
          files.fileName,
        mimeType:
          files.mimeType,
        sizeBytes:
          files.sizeBytes,
        status:
          files.status,
        createdAt:
          files.createdAt
      })
      .from(files)
      .where(
        eq(
          files.userId,
          safeUserId
        )
      )
      .orderBy(
        desc(
          files.createdAt
        )
      );

  const mem =
    await getMemories(
      safeUserId
    );

  return {
    exportVersion: 1,
    exportedAt:
      new Date().toISOString(),

    profile,

    conversations:
      chats,

    messages:
      msgs,

    files:
      userFiles,

    memories:
      mem
  };
}
