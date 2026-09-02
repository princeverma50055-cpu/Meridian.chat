import { eq, and, ilike, or } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import {
  users,
  profiles,
  conversations,
  messages,
  files,
  memories
} from '@/lib/db/schema';

export async function getProfile(userId: string) {
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      createdAt: users.createdAt
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return {
    user,
    profile:
      profile ??
      {
        userId,
        plan: 'free',
        preferences: {}
      }
  };
}

export async function updateProfile(
  userId: string,
  input: {
    name?: string;
    preferences?: Record<string, unknown>;
  }
) {
  const db = getDb();

  if (input.name !== undefined) {
    const name = input.name.trim().slice(0, 80);

    await db
      .update(users)
      .set({
        name: name || null
      })
      .where(eq(users.id, userId));
  }

  if (input.preferences !== undefined) {
    const [current] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.userId, userId))
      .limit(1);

    const previous =
      current?.preferences &&
      typeof current.preferences === 'object'
        ? (current.preferences as Record<string, unknown>)
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
        .where(eq(profiles.userId, userId));
    } else {
      await db.insert(profiles).values({
        userId,
        preferences: merged
      });
    }
  }

  return getProfile(userId);
}

export async function addMemory(
  userId: string,
  content: string
) {
  const db = getDb();

  const normalized = content
    .trim()
    .replace(/\s+/g, ' ')
    .slice(0, 1000);

  if (!normalized) {
    throw new Error('Memory content cannot be empty.');
  }

  const [row] = await db
    .insert(memories)
    .values({
      userId,
      content: normalized
    })
    .returning();

  return row;
}

export async function getMemories(userId: string) {
  const db = getDb();

  return db
    .select()
    .from(memories)
    .where(eq(memories.userId, userId))
    .orderBy(memories.createdAt);
}

export async function deleteMemory(
  userId: string,
  id: string
) {
  const db = getDb();

  if (!id?.trim()) {
    return false;
  }

  const deleted = await db
    .delete(memories)
    .where(
      and(
        eq(memories.id, id),
        eq(memories.userId, userId)
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

  await db
    .delete(memories)
    .where(eq(memories.userId, userId));

  return true;
}

export async function searchUserChats(
  userId: string,
  q: string
) {
  const db = getDb();

  const query = q.trim();

  if (!query) {
    return [];
  }

  const term = `%${query.slice(0, 100)}%`;

  return db
    .select({
      id: conversations.id,
      title: conversations.title,
      updatedAt: conversations.updatedAt
    })
    .from(conversations)
    .where(
      and(
        eq(conversations.userId, userId),
        ilike(conversations.title, term)
      )
    )
    .orderBy(conversations.updatedAt)
    .limit(50);
}

export async function exportUserData(
  userId: string
) {
  const db = getDb();

  const profile = await getProfile(userId);

  if (!profile) {
    throw new Error('User not found.');
  }

  const chats = await db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId));

  const chatIds = chats.map((chat) => chat.id);

  const msgs =
    chatIds.length > 0
      ? await db
          .select()
          .from(messages)
          .where(
            or(
              ...chatIds.map((id) =>
                eq(messages.conversationId, id)
              )
            )
          )
      : [];

  const userFiles = await db
    .select({
      id: files.id,
      fileName: files.fileName,
      mimeType: files.mimeType,
      sizeBytes: files.sizeBytes,
      status: files.status,
      createdAt: files.createdAt
    })
    .from(files)
    .where(eq(files.userId, userId));

  const userMemories = await getMemories(userId);

  return {
    exportedAt: new Date().toISOString(),
    profile,
    conversations: chats,
    messages: msgs,
    files: userFiles,
    memories: userMemories
  };
}
