import { getServerSession } from 'next-auth';
import { and, eq, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import { users, authSessions } from '@/lib/db/schema';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export class UnauthorizedError extends Error {
  public readonly status = 401 as const;

  constructor(message = 'Authentication required.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  sessionId: string;
}

type ServerSession = Awaited<
  ReturnType<typeof getServerSession>
>;

type SessionUser = {
  id?: string;
  sessionId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

/**
 * Safely extracts the user object from the NextAuth session.
 *
 * We intentionally use a local type assertion here because different
 * NextAuth/AuthOptions type configurations can expose the session
 * user fields differently to TypeScript.
 */
function getSessionUser(
  session: ServerSession
): SessionUser | null {
  const sessionWithUser = session as
    | (ServerSession & {
        user?: SessionUser | null;
      })
    | null;

  return sessionWithUser?.user ?? null;
}

async function createDatabaseSession(
  userId: string
): Promise<string> {
  const db = getDb();

  const id = randomUUID();

  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000
  );

  await db.insert(authSessions).values({
    id,
    userId,
    expiresAt,
  });

  return id;
}

async function getActiveSession(
  userId: string,
  sessionId: string
) {
  const db = getDb();

  const [session] = await db
    .select({
      id: authSessions.id,
    })
    .from(authSessions)
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        gt(authSessions.expiresAt, new Date())
      )
    )
    .limit(1);

  return session ?? null;
}

async function touchSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const db = getDb();

  await db
    .update(authSessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(
      and(
        eq(authSessions.id, sessionId),
        eq(authSessions.userId, userId),
        gt(authSessions.expiresAt, new Date())
      )
    );
}

export async function getCurrentUser(): Promise<CurrentUser> {
  let session: ServerSession;

  try {
    session = await getServerSession(authOptions);
  } catch (error) {
    console.error(
      '[auth] Session read failed:',
      error
    );

    throw new UnauthorizedError(
      'Unable to verify your authentication session.'
    );
  }

  const sessionUser = getSessionUser(session);

  /*
   * Explicitly guard against a missing session user.
   * This also makes sessionUser non-null for all code below,
   * avoiding TS18047 errors.
   */
  if (!sessionUser) {
    throw new UnauthorizedError(
      'You must be signed in to continue.'
    );
  }

  const userId = sessionUser.id?.trim();

  if (!userId) {
    throw new UnauthorizedError(
      'You must be signed in to continue.'
    );
  }

  try {
    const db = getDb();

    const [databaseUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!databaseUser) {
      throw new UnauthorizedError(
        'Your account could not be found. Please sign in again.'
      );
    }

    let sessionId =
      sessionUser.sessionId?.trim() ?? '';

    /*
     * If the JWT contains a database session ID,
     * verify that the database session is still active.
     */
    if (sessionId) {
      const activeSession =
        await getActiveSession(
          userId,
          sessionId
        );

      if (!activeSession) {
        sessionId = '';
      }
    }

    /*
     * Self-heal the authentication state if the
     * database session does not exist anymore.
     */
    if (!sessionId) {
      sessionId =
        await createDatabaseSession(userId);
    }

    await touchSession(
      userId,
      sessionId
    );

    return {
      id: databaseUser.id,
      email: databaseUser.email,
      name:
        databaseUser.name ??
        sessionUser.name ??
        null,
      image:
        databaseUser.avatarUrl ??
        sessionUser.image ??
        null,
      sessionId,
    };
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error;
    }

    console.error(
      '[auth] User lookup failed:',
      error
    );

    throw new UnauthorizedError(
      'Unable to verify your authentication session.'
    );
  }
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();

  return user.id;
}

export async function getOptionalCurrentUser(): Promise<
  CurrentUser | null
> {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return null;
    }

    throw error;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();

    return true;
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return false;
    }

    throw error;
  }
}

export function isUnauthorizedError(
  error: unknown
): error is UnauthorizedError {
  return error instanceof UnauthorizedError;
}

export function unauthorizedResponse(
  message = 'Authentication required.'
): Response {
  return Response.json(
    {
      error: 'UNAUTHORIZED',
      message,
    },
    {
      status: 401,
    }
  );
}
