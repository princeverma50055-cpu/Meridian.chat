import { getServerSession } from 'next-auth';
import { and, eq, gt } from 'drizzle-orm';

import { authOptions } from '@/lib/auth/config';
import { getDb } from '@/lib/db/client';
import { authSessions, users } from '@/lib/db/schema';

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

type SessionUserShape = {
  id?: string;
  sessionId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

type SessionShape = {
  user?: SessionUserShape;
} | null;

function getSessionUser(
  session: unknown
): SessionUserShape | null {
  const typedSession =
    session as SessionShape;

  return typedSession?.user ?? null;
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
        eq(
          authSessions.id,
          sessionId
        ),
        eq(
          authSessions.userId,
          userId
        ),
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
  userId: string,
  sessionId: string
): Promise<void> {
  const db = getDb();

  await db
    .update(authSessions)
    .set({
      lastSeenAt: new Date()
    })
    .where(
      and(
        eq(
          authSessions.id,
          sessionId
        ),
        eq(
          authSessions.userId,
          userId
        )
      )
    );
}

export async function getCurrentUser(): Promise<CurrentUser> {
  let session: unknown;

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

  const sessionUser =
    getSessionUser(session);

  if (
    !sessionUser?.id ||
    !sessionUser.sessionId
  ) {
    throw new UnauthorizedError(
      'You must be signed in to continue.'
    );
  }

  const userId =
    sessionUser.id.trim();

  const sessionId =
    sessionUser.sessionId.trim();

  if (
    !userId ||
    !sessionId
  ) {
    throw new UnauthorizedError(
      'Your authentication session is invalid.'
    );
  }

  try {
    const active =
      await validateDatabaseSession(
        userId,
        sessionId
      );

    if (!active) {
      throw new UnauthorizedError(
        'Your session has expired or been revoked. Please sign in again.'
      );
    }

    await touchDatabaseSession(
      userId,
      sessionId
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
          eq(
            users.id,
            userId
          )
        )
        .limit(1);

    if (!databaseUser) {
      throw new UnauthorizedError(
        'Your account could not be found. Please sign in again.'
      );
    }

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
) {
  return new Response(
    JSON.stringify({
      error: message
    }),
    {
      status: 401,
      headers: {
        'Content-Type':
          'application/json',
        'Cache-Control':
          'no-store',
        'X-Content-Type-Options':
          'nosniff'
      }
    }
  );
}

export async function requireUser(): Promise<CurrentUser> {
  return getCurrentUser();
}

export async function requireUserId(): Promise<string> {
  return getCurrentUserId();
}

export async function requireUserOrNull(): Promise<
  CurrentUser | null
> {
  return getOptionalCurrentUser();
}
