import { getServerSession } from "next-auth";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

import { authOptions } from "./auth";
import { getDb } from "@/lib/db";
import { authSessions, users } from "@/lib/db/schema";

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

export interface SessionUser {
  id: string;
  sessionId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
}

type ServerSession = Awaited<ReturnType<typeof getServerSession>>;

export interface CurrentUser {
  id: string;
  email: string | null;
  name: string | null;
  image: string | null;
  sessionId: string;
}

function getSessionUser(session: ServerSession): SessionUser | null {
  const user = session?.user as
    | {
        id?: string;
        sessionId?: string;
        email?: string | null;
        name?: string | null;
        image?: string | null;
      }
    | undefined;

  if (!user?.id) {
    return null;
  }

  return {
    id: user.id,
    sessionId: user.sessionId,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
  };
}

async function createDatabaseSession(userId: string): Promise<string> {
  const db = getDb();

  const id = randomUUID();

  const expiresAt = new Date(
    Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  );

  await db.insert(authSessions).values({
    id,
    userId,
    expiresAt,
  });

  return id;
}

async function getActiveDatabaseSession(
  userId: string,
  sessionId: string,
): Promise<string | null> {
  const db = getDb();

  const rows = await db
    .select({
      id: authSessions.id,
      expiresAt: authSessions.expiresAt,
    })
    .from(authSessions)
    .where(eq(authSessions.id, sessionId))
    .limit(1);

  const databaseSession = rows[0];

  if (!databaseSession) {
    return null;
  }

  if (databaseSession.expiresAt.getTime() <= Date.now()) {
    await db
      .delete(authSessions)
      .where(eq(authSessions.id, sessionId));

    return null;
  }

  return databaseSession.id;
}

async function touchDatabaseSession(sessionId: string): Promise<void> {
  const db = getDb();

  await db
    .update(authSessions)
    .set({
      lastSeenAt: new Date(),
    })
    .where(eq(authSessions.id, sessionId));
}

export async function getCurrentUser(): Promise<CurrentUser> {
  const session = await getServerSession(authOptions);
  const sessionUser = getSessionUser(session);

  if (!sessionUser?.id) {
    throw new Error("Unauthorized");
  }

  const db = getDb();

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      image: users.image,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1);

  const user = rows[0];

  if (!user) {
    throw new Error("Unauthorized");
  }

  let databaseSessionId: string | null = null;

  if (sessionUser.sessionId) {
    databaseSessionId = await getActiveDatabaseSession(
      sessionUser.id,
      sessionUser.sessionId,
    );
  }

  if (!databaseSessionId) {
    databaseSessionId = await createDatabaseSession(sessionUser.id);
  } else {
    await touchDatabaseSession(databaseSessionId);
  }

  return {
    id: user.id,
    email: user.email ?? null,
    name: user.name ?? null,
    image: user.image ?? null,
    sessionId: databaseSessionId,
  };
}

export async function getCurrentUserId(): Promise<string> {
  const user = await getCurrentUser();
  return user.id;
}

export async function getOptionalCurrentUser(): Promise<CurrentUser | null> {
  try {
    return await getCurrentUser();
  } catch {
    return null;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  const user = await getOptionalCurrentUser();
  return user !== null;
}

export function isUnauthorizedError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.message.toLowerCase() === "unauthorized"
  );
}

export function unauthorizedResponse() {
  return Response.json(
    {
      error: "Unauthorized",
      message: "Please sign in to continue.",
    },
    {
      status: 401,
    },
  );
}
