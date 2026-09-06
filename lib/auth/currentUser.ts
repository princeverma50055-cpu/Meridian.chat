import { getServerSession } from 'next-auth';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import {
  users,
  authSessions
} from '@/lib/db/schema';

const SESSION_MAX_AGE_SECONDS =
  30 * 24 * 60 * 60;

export class UnauthorizedError extends Error {
  public readonly status = 401 as const;

  constructor(
    message = 'Authentication required.'
  ) {
    super(message);
    this.name =
      'UnauthorizedError';
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

function getSessionUser(
  session: ServerSession
): SessionUser | null {
  const sessionWithUser =
    session as
      | (ServerSession & {
          user?: SessionUser | null;
        })
      | null;

  return (
    sessionWithUser?.user ??
    null
  );
}

/**
 * Creates an application-level database
 * session.
 *
 * IMPORTANT:
 * This is supplementary only.
 * Failure here must NEVER invalidate
 * an otherwise valid NextAuth session.
 */
async function createDatabaseSession(
  userId: string
): Promise<string | null> {
  try {
    const db = getDb();

    const id = randomUUID();

    const expiresAt =
      new Date(
        Date.now() +
          SESSION_MAX_AGE_SECONDS *
            1000
      );

    await db
      .insert(authSessions)
      .values({
        id,
        userId,
        expiresAt
      });

    return id;
  } catch (error) {
    console.error(
      '[auth] Could not create database session. Continuing with JWT authentication:',
      error
    );

    return null;
  }
}

/**
 * Updates an application database session.
 *
 * Failure is intentionally ignored because
 * authSessions is not the source of truth.
 */
async function touchDatabaseSession(
  userId: string,
  sessionId: string
): Promise<void> {
  try {
    const db = getDb();

    await db
      .update(authSessions)
      .set({
        lastSeenAt:
          new Date()
      })
      .where(
        eq(
          authSessions.id,
          sessionId
        )
      );
  } catch (error) {
    console.error(
      '[auth] Could not update database session:',
      error
    );
  }
}

/**
 * Resolve the currently authenticated user.
 *
 * Authentication source:
 *
 *     NextAuth JWT
 *
 * Database session:
 *
 *     Supplementary only
 */
export async function getCurrentUser(): Promise<CurrentUser> {
  let session: ServerSession;

  /*
   * -------------------------------------------------------
   * 1. Read NextAuth session
   * -------------------------------------------------------
   */
  try {
    session =
      await getServerSession(
        authOptions
      );
  } catch (error) {
    console.error(
      '[auth] NextAuth session read failed:',
      error
    );

    throw new UnauthorizedError(
      'Unable to verify your authentication session.'
    );
  }

  const sessionUser =
    getSessionUser(session);

  /*
   * A missing NextAuth session really means
   * the user is not authenticated.
   */
  if (!sessionUser) {
    throw new UnauthorizedError(
      'You must be signed in to continue.'
    );
  }

  /*
   * -------------------------------------------------------
   * 2. Resolve user ID
   * -------------------------------------------------------
   *
   * Prefer session.user.id.
   *
   * If older/stale NextAuth session data does
   * not contain id, fall back to email.
   */
  let userId =
    sessionUser.id?.trim() ??
    '';

  let databaseUser:
    | {
        id: string;
        email: string;
        name: string | null;
        avatarUrl: string | null;
      }
    | null = null;

  try {
    const db = getDb();

    /*
     * First try by user ID.
     */
    if (userId) {
      const [user] =
        await db
          .select({
            id: users.id,
            email: users.email,
            name: users.name,
            avatarUrl:
              users.avatarUrl
          })
          .from(users)
          .where(
            eq(
              users.id,
              userId
            )
          )
          .limit(1);

      databaseUser =
        user ?? null;
    }

    /*
     * -----------------------------------------------------
     * Fallback: resolve account using email.
     * -----------------------------------------------------
     *
     * This is important for Google sessions created
     * before the local user ID was attached.
     */
    if (
      !databaseUser &&
      sessionUser.email
    ) {
      const email =
        sessionUser.email
          .trim()
          .toLowerCase();

      if (email) {
        const [user] =
          await db
            .select({
              id: users.id,
              email: users.email,
              name: users.name,
              avatarUrl:
                users.avatarUrl
            })
            .from(users)
            .where(
              eq(
                users.email,
                email
              )
            )
            .limit(1);

        databaseUser =
          user ?? null;
      }
    }
  } catch (error) {
    console.error(
      '[auth] User lookup failed:',
      error
    );

    throw new UnauthorizedError(
      'Unable to verify your authentication session.'
    );
  }

  /*
   * We have a valid NextAuth session but
   * no corresponding Meridian account.
   */
  if (!databaseUser) {
    throw new UnauthorizedError(
      'Your Meridian account could not be found. Please sign in again.'
    );
  }

  /*
   * Make sure we always have the local
   * database user ID from this point onward.
   */
  userId =
    databaseUser.id;

  /*
   * -------------------------------------------------------
   * 3. Database session handling
   * -------------------------------------------------------
   *
   * IMPORTANT:
   * authSessions is OPTIONAL.
   *
   * If it doesn't exist, is expired, or
   * cannot be written, authentication
   * must continue because NextAuth JWT
   * already authenticated the user.
   */
  let sessionId =
    sessionUser.sessionId?.trim() ??
    '';

  /*
   * If there is no session ID in the
   * NextAuth session, create one.
   */
  if (!sessionId) {
    const newSessionId =
      await createDatabaseSession(
        userId
      );

    if (newSessionId) {
      sessionId =
        newSessionId;
    }
  }

  /*
   * If database session creation failed,
   * generate an in-memory ID so the
   * CurrentUser contract remains valid.
   *
   * This ID is NOT treated as an authentication
   * credential. JWT is still the source of truth.
   */
  if (!sessionId) {
    sessionId =
      randomUUID();
  }

  /*
   * Best-effort session activity update.
   */
  await touchDatabaseSession(
    userId,
    sessionId
  );

  /*
   * -------------------------------------------------------
   * 4. Return authenticated user
   * -------------------------------------------------------
   */
  return {
    id:
      databaseUser.id,

    email:
      databaseUser.email,

    name:
      databaseUser.name ??
      sessionUser.name ??
      null,

    image:
      databaseUser.avatarUrl ??
      sessionUser.image ??
      null,

    sessionId
  };
}

/**
 * Returns only the authenticated
 * Meridian user ID.
 */
export async function getCurrentUserId(): Promise<string> {
  const user =
    await getCurrentUser();

  return user.id;
}

/**
 * Optional authentication helper.
 */
export async function getOptionalCurrentUser(): Promise<
  CurrentUser | null
> {
  try {
    return await getCurrentUser();
  } catch (error) {
    if (
      error instanceof
      UnauthorizedError
    ) {
      return null;
    }

    throw error;
  }
}

/**
 * Checks whether a valid NextAuth
 * session exists.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    await getCurrentUser();

    return true;
  } catch (error) {
    if (
      error instanceof
      UnauthorizedError
    ) {
      return false;
    }

    throw error;
  }
}

export function isUnauthorizedError(
  error: unknown
): error is UnauthorizedError {
  return (
    error instanceof
    UnauthorizedError
  );
}

export function unauthorizedResponse(
  message = 'Authentication required.'
): Response {
  return Response.json(
    {
      error:
        'UNAUTHORIZED',
      message
    },
    {
      status: 401
    }
  );
}
