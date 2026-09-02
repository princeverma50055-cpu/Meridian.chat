import type { NextAuthOptions, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { and, eq, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { getDb } from '@/lib/db/client';
import {
  users,
  profiles,
  authSessions
} from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';

const SESSION_MAX_AGE_SECONDS =
  30 * 24 * 60 * 60;

type MeridianToken = {
  sub?: string;
  sessionId?: string;
  email?: string;
  name?: string;
  picture?: string;
};

type MeridianSessionUser = {
  id?: string;
  sessionId?: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function getConfiguredGoogleProvider() {
  const clientId =
    process.env.GOOGLE_CLIENT_ID?.trim();

  const clientSecret =
    process.env.GOOGLE_CLIENT_SECRET?.trim();

  if (!clientId || !clientSecret) {
    return null;
  }

  return GoogleProvider({
    clientId,
    clientSecret
  });
}

async function provisionUser(
  email: string,
  name?: string | null,
  image?: string | null
): Promise<string | null> {
  const normalizedEmail =
    normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const db = getDb();

  const [existingUser] =
    await db
      .select({
        id: users.id
      })
      .from(users)
      .where(
        eq(
          users.email,
          normalizedEmail
        )
      )
      .limit(1);

  let userId =
    existingUser?.id;

  if (!userId) {
    const [created] =
      await db
        .insert(users)
        .values({
          email: normalizedEmail,
          name:
            name?.trim() ||
            undefined,
          avatarUrl:
            image?.trim() ||
            undefined
        })
        .returning({
          id: users.id
        });

    userId = created?.id;
  } else if (name || image) {
    await db
      .update(users)
      .set({
        ...(name?.trim()
          ? {
              name: name.trim()
            }
          : {}),
        ...(image?.trim()
          ? {
              avatarUrl:
                image.trim()
            }
          : {})
      })
      .where(
        eq(
          users.id,
          userId
        )
      );
  }

  if (!userId) {
    return null;
  }

  const [profile] =
    await db
      .select({
        userId:
          profiles.userId
      })
      .from(profiles)
      .where(
        eq(
          profiles.userId,
          userId
        )
      )
      .limit(1);

  if (!profile) {
    await db
      .insert(profiles)
      .values({
        userId
      })
      .onConflictDoNothing();
  }

  return userId;
}

async function createDatabaseSession(
  userId: string
): Promise<string> {
  const db = getDb();

  const sessionId =
    randomUUID();

  const expiresAt =
    new Date(
      Date.now() +
        SESSION_MAX_AGE_SECONDS *
          1000
    );

  await db
    .insert(authSessions)
    .values({
      id: sessionId,
      userId,
      expiresAt,
      lastSeenAt: new Date()
    });

  return sessionId;
}

async function isDatabaseSessionActive(
  sessionId: string,
  userId: string
): Promise<boolean> {
  if (!sessionId || !userId) {
    return false;
  }

  const db = getDb();

  const [row] =
    await db
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

  return Boolean(row);
}

async function ensureDatabaseSession(
  token: MeridianToken
): Promise<string | undefined> {
  if (!token.sub) {
    return undefined;
  }

  if (token.sessionId) {
    try {
      const active =
        await isDatabaseSessionActive(
          token.sessionId,
          token.sub
        );

      if (active) {
        return token.sessionId;
      }
    } catch (error) {
      console.error(
        '[auth] Existing session check failed:',
        error
      );
    }
  }

  try {
    return await createDatabaseSession(
      token.sub
    );
  } catch (error) {
    console.error(
      '[auth] Session creation failed:',
      error
    );

    return undefined;
  }
}

const credentialsProvider =
  CredentialsProvider({
    id: 'credentials',

    name: 'Email and password',

    credentials: {
      email: {
        label: 'Email',
        type: 'email',
        placeholder:
          'you@example.com'
      },
      password: {
        label: 'Password',
        type: 'password'
      }
    },

    async authorize(
      credentials
    ) {
      if (
        !credentials?.email ||
        !credentials.password
      ) {
        return null;
      }

      const email =
        normalizeEmail(
          credentials.email
        );

      if (!email) {
        return null;
      }

      const db = getDb();

      const [user] =
        await db
          .select()
          .from(users)
          .where(
            eq(
              users.email,
              email
            )
          )
          .limit(1);

      if (
        !user?.passwordHash
      ) {
        return null;
      }

      const valid =
        verifyPassword(
          credentials.password,
          user.passwordHash
        );

      if (!valid) {
        return null;
      }

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.avatarUrl
      } satisfies User;
    }
  });

const googleProvider =
  getConfiguredGoogleProvider();

export const authOptions: NextAuthOptions =
  {
    secret:
      process.env.AUTH_SECRET,

    session: {
      strategy: 'jwt',
      maxAge:
        SESSION_MAX_AGE_SECONDS,
      updateAge:
        24 * 60 * 60
    },

    pages: {
      signIn: '/login'
    },

    providers:
      googleProvider
        ? [
            googleProvider,
            credentialsProvider
          ]
        : [
            credentialsProvider
          ],

    callbacks: {
      async signIn({
        user
      }) {
        if (!user.email) {
          return false;
        }

        try {
          const userId =
            await provisionUser(
              user.email,
              user.name,
              user.image
            );

          if (!userId) {
            return false;
          }

          user.id = userId;

          return true;
        } catch (error) {
          console.error(
            '[auth] Sign-in provisioning failed:',
            error
          );

          return false;
        }
      },

      async jwt({
        token,
        user
      }) {
        const typedToken =
          token as MeridianToken;

        if (user?.id) {
          typedToken.sub =
            user.id;
        }

        if (user?.email) {
          typedToken.email =
            user.email;
        }

        if (user?.name) {
          typedToken.name =
            user.name;
        }

        if (user?.image) {
          typedToken.picture =
            user.image;
        }

        if (typedToken.sub) {
          const sessionId =
            await ensureDatabaseSession(
              typedToken
            );

          if (sessionId) {
            typedToken.sessionId =
              sessionId;
          } else {
            delete typedToken.sessionId;
          }
        }

        return typedToken;
      },

      async session({
        session,
        token
      }) {
        const typedToken =
          token as MeridianToken;

        const sessionUser =
          session.user as MeridianSessionUser;

        if (!typedToken.sub) {
          return {
            ...session,
            user: undefined
          };
        }

        /*
         * Self-healing:
         * If authSessions was deleted/expired,
         * create a fresh DB session instead of
         * immediately breaking authentication.
         */
        const sessionId =
          await ensureDatabaseSession(
            typedToken
          );

        if (!sessionId) {
          return {
            ...session,
            user: undefined
          };
        }

        typedToken.sessionId =
          sessionId;

        sessionUser.id =
          typedToken.sub;

        sessionUser.sessionId =
          sessionId;

        sessionUser.email =
          typedToken.email ??
          sessionUser.email ??
          null;

        sessionUser.name =
          typedToken.name ??
          sessionUser.name ??
          null;

        sessionUser.image =
          typedToken.picture ??
          sessionUser.image ??
          null;

        try {
          const db = getDb();

          await db
            .update(authSessions)
            .set({
              lastSeenAt:
                new Date()
            })
            .where(
              and(
                eq(
                  authSessions.id,
                  sessionId
                ),
                eq(
                  authSessions.userId,
                  typedToken.sub
                )
              )
            );
        } catch (error) {
          console.error(
            '[auth] Session activity update failed:',
            error
          );
        }

        return session;
      }
    },

    events: {
      async signOut({
        token
      }) {
        const typedToken =
          token as MeridianToken |
            undefined;

        if (
          !typedToken?.sessionId
        ) {
          return;
        }

        try {
          await getDb()
            .delete(
              authSessions
            )
            .where(
              eq(
                authSessions.id,
                typedToken.sessionId
              )
            );
        } catch (error) {
          console.error(
            '[auth] Failed to revoke session:',
            error
          );
        }
      }
    }
  };
