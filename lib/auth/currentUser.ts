import { getServerSession } from 'next-auth';
import { and, eq, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import {
  users,
  authSessions,
} from '@/lib/db/schema';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type ServerSession = Awaited<
  ReturnType<typeof getServerSession>
>;

interface SessionUser {
  id?: string;
  sessionId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  sessionId: string;
}

/**
 * Error used whenever a protected API/page
 * requires an authenticated user.
 */
export class UnauthorizedError extends Error {
  public readonly status = 401 as const;

  constructor(
    message = 'Authentication required.'
  ) {
    super(message);
    this.name = 'UnauthorizedError';

    Object.setPrototypeOf(
      this,
      UnauthorizedError.prototype
    );
  }
}

/**
 * Safely extracts the Meridian session user.
 */
function getSessionUser(
  session: ServerSession
): SessionUser | null {
  if (!session?.user) {
    return null;
  }

  return session.user as SessionUser;
}

/**
 * Creates a database session for the authenticated user.
 */
async function createDatabaseSession(
  userId: string
): Promise<string> {
  const db = getDb();

  const sessionId = randomUUID();

  const expiresAt = new Date(
    Date.now() +
      SESSION_MAX_AGE_SECONDS * 1000
  );

  await db.insert(authSessions).values({
    id: sessionId,
    userId,
    expiresAt,
    lastSeenAt: new Date(),
  });

  return sessionId;
}

/**
 * Checks whether an existing database session
 * is still active.
 */
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
        gt(
          authSessions.expiresAt,
          new Date()
        )
      )
    )
    .limit(1);

  return session ?? null;
}

/**
 * Updates the last activity timestamp.
 */
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
        gt(
          authSessions.expiresAt,
          new Date()
        )
      )
    );
}

/**
 * Returns the currently authenticated Meridian user.
 *
 * This function:
 * 1. Reads the NextAuth session.
 * 2. Gets the authenticated user ID.
 * 3. Loads the user from PostgreSQL.
 * 4. Validates the database session.
 * 5. Creates a new DB session when necessary.
 * 6. Updates session activity.
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  let session: ServerSession;

  try {
    session = await getServerSession(
      authOptions
    );
  } catch (error) {
    console.error(
      '[auth] Failed to read NextAuth session:',
      error
    );

    throw new UnauthorizedError(
      'Unable to verify your authentication session.'
    );
  }

  const sessionUser = getSessionUser(session);

  const userId =
    sessionUser?.id?.trim();

  if (!userId) {
    throw new UnauthorizedError(
      'You must be signed in to continue.'
    );
  }

  try {
    const db = getDb();

    /**
     * Load the real user from PostgreSQL.
     */
    const [databaseUser] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(users)
      .where(
        eq(users.id, userId)
      )
      .limit(1);

    if (!databaseUser) {
      throw new UnauthorizedError(
        'Your account could not be found. Please sign in again.'
      );
    }

    /**
     * Validate the database session supplied
     * by the NextAuth JWT.
     */
    let sessionId =
      sessionUser.sessionId?.trim() ?? '';

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

    /**
     * Self-heal if the database session was
     * deleted or expired.
     */
    if (!sessionId) {
      sessionId =
        await createDatabaseSession(
          userId
        );
    }

    /**
     * Update activity timestamp.
     */
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
    if (
      error instanceof UnauthorizedError
    ) {
      throw error;
    }

    console.error(
      '[auth] User lookup/session verification failed:',
      error
    );

    throw new UnauthorizedError(
      'Unable to verify your authentication session.'
    );
  }
}

/**
 * Returns only the authenticated user's ID.
 */
export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();

  return user.id;
}

/**
 * Returns the authenticated user or null
 * when the request is unauthenticated.
 */
export async function getOptionalCurrentUser(): Promise<
  CurrentUser | null
> {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (
      error instanceof UnauthorizedError
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Checks authentication status.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();

    return true;
  } catch (error) {
    if (
      error instanceof UnauthorizedError
    ) {
      return false;
    }

    throw error;
  }
}

/**
 * Type guard for authentication errors.
 */
export function isUnauthorizedError(
  error: unknown
): error is UnauthorizedError {
  return (
    error instanceof UnauthorizedError
  );
}

/**
 * Standard 401 response for protected APIs.
 */
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
