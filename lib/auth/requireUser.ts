import { getServerSession } from 'next-auth';
import { and, eq, gt } from 'drizzle-orm';
import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import { authSessions, users } from '@/lib/db/schema';

export class UnauthorizedError extends Error {
  public readonly status = 401 as const;

  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  sessionId: string;
}

interface NextAuthUser {
  id?: string;
  sessionId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

interface NextAuthSession {
  user?: NextAuthUser;
  expires?: string;
}

function isValidDate(value: string | undefined): boolean {
  if (!value) {
    return false;
  }

  const timestamp = Date.parse(value);

  return Number.isFinite(timestamp);
}

function isExpired(date: Date): boolean {
  return date.getTime() <= Date.now();
}

export async function requireUser(): Promise<AuthenticatedUser> {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    throw new UnauthorizedError('You must be signed in to continue.');
  }

  const authUser = session.user as NextAuthUser;

  const userId = authUser.id;
  const sessionId = authUser.sessionId;
  const email = authUser.email?.trim().toLowerCase();

  if (!userId || !sessionId || !email) {
    throw new UnauthorizedError('Your authentication session is invalid. Please sign in again.');
  }

  const sessionData = session as NextAuthSession;

  if (sessionData.expires && !isValidDate(sessionData.expires)) {
    throw new UnauthorizedError('Your authentication session is invalid. Please sign in again.');
  }

  if (sessionData.expires && isExpired(new Date(sessionData.expires))) {
    throw new UnauthorizedError('Your session has expired. Please sign in again.');
  }

  /*
   * IMPORTANT: only a genuine "this session is not valid" outcome
   * (no row found, or the row is expired) should become an
   * UnauthorizedError and force a logout. A thrown error from the
   * query itself (DB unreachable, pool exhausted, timeout, etc.)
   * is an infrastructure problem, not proof the session is bad —
   * it is rethrown as-is so callers surface it as a 500/retryable
   * error instead of kicking a legitimately signed-in user out.
   */
  let authenticatedUser:
    | {
        id: string;
        email: string;
        name: string | null;
        avatarUrl: string | null;
        sessionId: string;
        sessionExpiresAt: Date;
      }
    | undefined;

  const db = getDb();

  try {
    [authenticatedUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
        sessionId: authSessions.id,
        sessionExpiresAt: authSessions.expiresAt
      })
      .from(authSessions)
      .innerJoin(users, eq(authSessions.userId, users.id))
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId),
          eq(users.id, userId),
          gt(authSessions.expiresAt, new Date())
        )
      )
      .limit(1);
  } catch (error) {
    console.error(
      '[auth] Failed to validate authenticated user (treating as transient, not logging out):',
      error
    );

    throw error;
  }

  if (!authenticatedUser) {
    throw new UnauthorizedError(
      'Your session has expired or has been revoked. Please sign in again.'
    );
  }

  if (isExpired(authenticatedUser.sessionExpiresAt)) {
    try {
      await db
        .delete(authSessions)
        .where(
          and(
            eq(authSessions.id, sessionId),
            eq(authSessions.userId, userId)
          )
        );
    } catch (error) {
      console.error('[auth] Failed to clean up expired session:', error);
    }

    throw new UnauthorizedError(
      'Your session has expired. Please sign in again.'
    );
  }

  try {
    await db
      .update(authSessions)
      .set({
        lastSeenAt: new Date()
      })
      .where(
        and(
          eq(authSessions.id, sessionId),
          eq(authSessions.userId, userId)
        )
      );
  } catch (error) {
    /*
     * Failing to update "last seen" is not worth logging the
     * user out over — log it and continue.
     */
    console.error('[auth] Failed to touch session lastSeenAt:', error);
  }

  return {
    id: authenticatedUser.id,
    email: authenticatedUser.email,
    name: authenticatedUser.name ?? null,
    image: authenticatedUser.avatarUrl ?? null,
    sessionId: authenticatedUser.sessionId
  };
}

export async function requireUserId(): Promise<string> {
  const user = await requireUser();

  return user.id;
}

export async function getAuthenticatedUser(): Promise<AuthenticatedUser | null> {
  try {
    return await requireUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }

    throw error;
  }
}

export function isUnauthorizedError(error: unknown): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

export function unauthorizedResponse(
  message = 'Authentication required.'
): Response {
  return Response.json(
    {
      error: 'UNAUTHORIZED',
      message
    },
    {
      status: 401
    }
  );
}

export async function requireUserOrNull(): Promise<AuthenticatedUser | null> {
  return getAuthenticatedUser();
}
