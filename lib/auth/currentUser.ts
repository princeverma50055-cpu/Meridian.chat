import { getServerSession } from 'next-auth';
import { and, eq, gt } from 'drizzle-orm';
import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import { users, authSessions } from '@/lib/db/schema';

export class UnauthorizedError extends Error {
  public readonly status = 401 as const;

  constructor(
    message = 'Authentication required.'
  ) {
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

interface SessionUser {
  id?: string;
  sessionId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

function getSessionUser(
  session: Awaited<
    ReturnType<typeof getServerSession>
  >
): SessionUser | null {
  if (!session?.user) {
    return null;
  }

  return session.user as SessionUser;
}

async function validateDatabaseSession(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const db = getDb();

  const [activeSession] = await db
    .select({
      id: authSessions.id
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

  return Boolean(activeSession);
}

async function touchDatabaseSession(
  sessionId: string,
  userId: string
): Promise<void> {
  const db = getDb();

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
}

export async function getCurrentUser(): Promise<CurrentUser> {
  let session:
    Awaited<
      ReturnType<typeof getServerSession>
    >;

  try {
    session =
      await getServerSession(
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

  const user =
    getSessionUser(session);

  if (
    !user?.id ||
    !user.sessionId
  ) {
    throw new UnauthorizedError(
      'You must be signed in to continue.'
    );
  }

  const userId =
    user.id.trim();

  const sessionId =
    user.sessionId.trim();

  if (
    !userId ||
    !sessionId
  ) {
    throw new UnauthorizedError(
      'Your authentication session is invalid.'
    );
  }

  try {
    const isActive =
      await validateDatabaseSession(
        userId,
        sessionId
      );

    if (!isActive) {
      throw new UnauthorizedError(
        'Your session has expired or been revoked. Please sign in again.'
      );
    }

    await touchDatabaseSession(
      sessionId,
      userId
    );

    const db = getDb();

    const [databaseUser] =
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
          eq(users.id, userId)
        )
        .limit(1);

    if (!databaseUser) {
      throw new UnauthorizedError(
        'Your account could not be found. Please sign in again.'
      );
    }

    return {
      id: databaseUser.id,
      email:
        databaseUser.email,
      name:
        databaseUser.name ??
        user.name ??
        null,
      image:
        databaseUser.avatarUrl ??
        user.image ??
        null,
      sessionId
    };
  } catch (error) {
    if (
      error instanceof UnauthorizedError
    ) {
      throw error;
    }

    console.error(
      '[auth] Current user lookup failed:',
      error
    );

    throw new UnauthorizedError(
      'Unable to verify your authentication session.'
    );
  }
}

export async function getCurrentUserId(): Promise<string> {
  const user =
    await getCurrentUser();

  return user.id;
}

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

export function isUnauthorizedError(
  error: unknown
): error is UnauthorizedError {
  return (
    error instanceof UnauthorizedError
  );
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
