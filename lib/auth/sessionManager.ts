import { and, eq, gt, lt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { authSessions } from '@/lib/db/schema';

const DEFAULT_SESSION_DAYS = 30;
const MAX_SESSION_DAYS = 90;

export interface CreateSessionOptions {
  userId: string;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresInDays?: number;
}

export interface SessionRecord {
  id: string;
  userId: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: Date;
  lastSeenAt: Date;
  expiresAt: Date;
}

export class SessionManagerError extends Error {
  public readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'SessionManagerError';
    this.code = code;
  }
}

function normalizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  return normalized.slice(0, maxLength);
}

function normalizeDays(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_SESSION_DAYS;
  }

  return Math.min(
    Math.max(Math.floor(value), 1),
    MAX_SESSION_DAYS
  );
}

function getExpiryDate(days: number): Date {
  return new Date(
    Date.now() + days * 24 * 60 * 60 * 1000
  );
}

export async function createAuthSession(
  options: CreateSessionOptions
): Promise<SessionRecord> {
  const userId = normalizeOptionalString(options.userId, 100);

  if (!userId) {
    throw new SessionManagerError(
      'INVALID_USER',
      'A valid user ID is required to create a session.'
    );
  }

  const userAgent = normalizeOptionalString(
    options.userAgent,
    1000
  );

  const ipAddress = normalizeOptionalString(
    options.ipAddress,
    100
  );

  const expiresAt = getExpiryDate(
    normalizeDays(options.expiresInDays)
  );

  const sessionId = randomUUID();

  const db = getDb();

  const [session] = await db
    .insert(authSessions)
    .values({
      id: sessionId,
      userId,
      userAgent,
      ipAddress,
      expiresAt
    })
    .returning();

  if (!session) {
    throw new SessionManagerError(
      'SESSION_CREATE_FAILED',
      'Unable to create an authentication session.'
    );
  }

  return session;
}

export async function getAuthSession(
  sessionId: string,
  userId?: string
): Promise<SessionRecord | null> {
  if (!sessionId || typeof sessionId !== 'string') {
    return null;
  }

  const normalizedUserId =
    typeof userId === 'string' && userId.trim()
      ? userId.trim()
      : null;

  const db = getDb();

  const conditions = [
    eq(authSessions.id, sessionId),
    gt(authSessions.expiresAt, new Date())
  ];

  if (normalizedUserId) {
    conditions.push(
      eq(authSessions.userId, normalizedUserId)
    );
  }

  const [session] = await db
    .select()
    .from(authSessions)
    .where(and(...conditions))
    .limit(1);

  return session ?? null;
}

export async function isSessionActive(
  sessionId: string,
  userId?: string
): Promise<boolean> {
  const session = await getAuthSession(
    sessionId,
    userId
  );

  return Boolean(session);
}

export async function touchAuthSession(
  sessionId: string,
  userId: string
): Promise<boolean> {
  if (!sessionId || !userId) {
    return false;
  }

  const db = getDb();

  const result = await db
    .update(authSessions)
    .set({
      lastSeenAt: new Date()
    })
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .returning({
      id: authSessions.id
    });

  return result.length > 0;
}

export async function revokeAuthSession(
  sessionId: string,
  userId?: string
): Promise<boolean> {
  if (!sessionId || typeof sessionId !== 'string') {
    return false;
  }

  const db = getDb();

  const conditions = [
    eq(authSessions.id, sessionId)
  ];

  if (userId) {
    conditions.push(
      eq(authSessions.userId, userId)
    );
  }

  const result = await db
    .delete(authSessions)
    .where(and(...conditions))
    .returning({
      id: authSessions.id
    });

  return result.length > 0;
}

export async function revokeAllAuthSessions(
  userId: string,
  exceptSessionId?: string
): Promise<number> {
  if (!userId) {
    return 0;
  }

  const db = getDb();

  if (exceptSessionId) {
    const sessions = await db
      .select({
        id: authSessions.id
      })
      .from(authSessions)
      .where(
        eq(authSessions.userId, userId)
      );

    const idsToDelete = sessions
      .map((session) => session.id)
      .filter((id) => id !== exceptSessionId);

    if (idsToDelete.length === 0) {
      return 0;
    }

    let deletedCount = 0;

    for (const id of idsToDelete) {
      const result = await db
        .delete(authSessions)
        .where(
          and(
            eq(authSessions.id, id),
            eq(authSessions.userId, userId)
          )
        )
        .returning({
          id: authSessions.id
        });

      deletedCount += result.length;
    }

    return deletedCount;
  }

  const deleted = await db
    .delete(authSessions)
    .where(
      eq(authSessions.userId, userId)
    )
    .returning({
      id: authSessions.id
    });

  return deleted.length;
}

export async function listAuthSessions(
  userId: string,
  currentSessionId?: string
): Promise<
  Array<
    SessionRecord & {
      isCurrent: boolean;
      isExpired: boolean;
    }
  >
> {
  if (!userId) {
    return [];
  }

  const db = getDb();

  const sessions = await db
    .select()
    .from(authSessions)
    .where(
      eq(authSessions.userId, userId)
    )
    .orderBy(authSessions.lastSeenAt);

  const now = Date.now();

  return sessions.map((session) => ({
    ...session,
    isCurrent: Boolean(
      currentSessionId &&
      session.id === currentSessionId
    ),
    isExpired:
      session.expiresAt.getTime() <= now
  }));
}

export async function cleanupExpiredSessions(): Promise<number> {
  const db = getDb();

  const deleted = await db
    .delete(authSessions)
    .where(
      lt(authSessions.expiresAt, new Date())
    )
    .returning({
      id: authSessions.id
    });

  return deleted.length;
}

export async function revokeExpiredSessionsForUser(
  userId: string
): Promise<number> {
  if (!userId) {
    return 0;
  }

  const db = getDb();

  const deleted = await db
    .delete(authSessions)
    .where(
      and(
        eq(authSessions.userId, userId),
        lt(authSessions.expiresAt, new Date())
      )
    )
    .returning({
      id: authSessions.id
    });

  return deleted.length;
}

export async function getSessionCount(
  userId: string
): Promise<number> {
  if (!userId) {
    return 0;
  }

  const db = getDb();

  const sessions = await db
    .select({
      id: authSessions.id
    })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.userId, userId),
        gt(authSessions.expiresAt, new Date())
      )
    );

  return sessions.length;
}
