import type {
  NextAuthOptions,
  User as NextAuthUser,
} from 'next-auth';
import type { JWT } from 'next-auth/jwt';

import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';

import { getDb } from '@/lib/db/client';
import {
  users,
  authSessions,
} from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';

const SESSION_MAX_AGE_SECONDS =
  30 * 24 * 60 * 60;

interface AppToken extends JWT {
  userId?: string;
  sessionId?: string;
}

interface AppUser extends NextAuthUser {
  id: string;
  sessionId?: string;
}

function normalizeEmail(
  email: string | null | undefined
): string | null {
  const value = email?.trim().toLowerCase();

  return value || null;
}

async function findUserByEmail(
  email: string
) {
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  return user ?? null;
}

async function findUserById(
  userId: string
) {
  const db = getDb();

  const [user] = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      avatarUrl: users.avatarUrl,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  return user ?? null;
}

async function createAuthSession(
  userId: string
): Promise<string | undefined> {
  try {
    const db = getDb();

    const sessionId = randomUUID();

    const expiresAt = new Date(
      Date.now() +
        SESSION_MAX_AGE_SECONDS * 1000
    );

    await db
      .insert(authSessions)
      .values({
        id: sessionId,
        userId,
        expiresAt,
      });

    return sessionId;
  } catch (error) {
    console.error(
      '[auth] Database session creation failed:',
      error
    );

    return undefined;
  }
}

async function touchAuthSession(
  sessionId: string
): Promise<void> {
  try {
    const db = getDb();

    await db
      .update(authSessions)
      .set({
        lastSeenAt: new Date(),
      })
      .where(
        eq(
          authSessions.id,
          sessionId
        )
      );
  } catch (error) {
    console.error(
      '[auth] Database session update failed:',
      error
    );
  }
}

async function provisionUser(
  user: {
    id?: string;
    email?: string | null;
    name?: string | null;
    image?: string | null;
  }
): Promise<string | null> {
  const email = normalizeEmail(
    user.email
  );

  if (!email) {
    return null;
  }

  try {
    const existing =
      await findUserByEmail(email);

    if (existing) {
      return existing.id;
    }

    const userId =
      user.id?.trim() || randomUUID();

    const db = getDb();

    await db
      .insert(users)
      .values({
        id: userId,
        email,
        name:
          user.name?.trim() || null,
        avatarUrl:
          user.image || null,
      });

    return userId;
  } catch (error) {
    try {
      const existing =
        await findUserByEmail(email);

      if (existing) {
        return existing.id;
      }
    } catch {
      // Ignore secondary lookup failure.
    }

    console.error(
      '[auth] User provisioning failed:',
      error
    );

    return null;
  }
}

export const authOptions: NextAuthOptions = {
  /*
   * Support both common secret names.
   */
  secret:
    process.env.AUTH_SECRET ??
    process.env.NEXTAUTH_SECRET,

  providers: [
    GoogleProvider({
      clientId:
        process.env.GOOGLE_CLIENT_ID ?? '',
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),

    CredentialsProvider({
      name: 'Credentials',

      credentials: {
        email: {
          label: 'Email',
          type: 'email',
        },
        password: {
          label: 'Password',
          type: 'password',
        },
      },

      async authorize(credentials) {
        const email =
          normalizeEmail(
            credentials?.email
          );

        const password =
          credentials?.password;

        if (!email || !password) {
          return null;
        }

        try {
          const user =
            await findUserByEmail(email);

          if (
            !user ||
            !user.passwordHash
          ) {
            return null;
          }

          const valid =
            await verifyPassword(
              password,
              user.passwordHash
            );

          if (!valid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.avatarUrl,
          };
        } catch (error) {
          console.error(
            '[auth] Credentials authorization failed:',
            error
          );

          return null;
        }
      },
    }),
  ],

  session: {
    strategy: 'jwt',
    maxAge:
      SESSION_MAX_AGE_SECONDS,
    updateAge:
      24 * 60 * 60,
  },

  pages: {
    signIn: '/login',
  },

  callbacks: {
    async signIn({
      user,
      account,
    }) {
      if (
        account?.provider ===
        'credentials'
      ) {
        return true;
      }

      if (
        account?.provider === 'google'
      ) {
        const userId =
          await provisionUser(user);

        if (!userId) {
          console.error(
            '[auth] Google user provisioning failed.'
          );

          return false;
        }

        user.id = userId;

        return true;
      }

      return true;
    },

    async jwt({
      token,
      user,
    }) {
      const appToken =
        token as AppToken;

      if (user) {
        const appUser =
          user as AppUser;

        let userId =
          appUser.id?.trim();

        if (!userId) {
          const email =
            normalizeEmail(
              appUser.email
            );

          if (email) {
            const databaseUser =
              await findUserByEmail(
                email
              );

            userId =
              databaseUser?.id;
          }
        }

        if (userId) {
          appToken.userId =
            userId;

          const sessionId =
            await createAuthSession(
              userId
            );

          if (sessionId) {
            appToken.sessionId =
              sessionId;
          }
        }

        if (appUser.email) {
          appToken.email =
            appUser.email;
        }

        if (appUser.name) {
          appToken.name =
            appUser.name;
        }

        if (appUser.image) {
          appToken.picture =
            appUser.image;
        }
      }

      /*
       * Database session is supplementary.
       * JWT remains the source of truth.
       */
      if (appToken.sessionId) {
        await touchAuthSession(
          appToken.sessionId
        );
      }

      return appToken;
    },

    async session({
      session,
      token,
    }) {
      const appToken =
        token as AppToken;

      const userId =
        appToken.userId;

      if (!userId) {
        return session;
      }

      let databaseUser:
        | Awaited<
            ReturnType<
              typeof findUserById
            >
          >
        | null = null;

      try {
        databaseUser =
          await findUserById(userId);
      } catch (error) {
        console.error(
          '[auth] User lookup during session failed:',
          error
        );
      }

      /*
       * Explicitly normalize optional
       * values to string | null.
       */
      const email =
        databaseUser?.email ??
        session.user?.email ??
        null;

      const name =
        databaseUser?.name ??
        session.user?.name ??
        null;

      const image =
        databaseUser?.avatarUrl ??
        session.user?.image ??
        null;

      session.user = {
        name,
        email,
        image,
        id: userId,
        sessionId:
          appToken.sessionId,
      };

      return session;
    },
  },

  events: {
    async signOut({
      token,
    }) {
      const appToken =
        token as AppToken;

      if (!appToken.sessionId) {
        return;
      }

      try {
        const db = getDb();

        await db
          .delete(authSessions)
          .where(
            eq(
              authSessions.id,
              appToken.sessionId
            )
          );
      } catch (error) {
        console.error(
          '[auth] Database session cleanup failed:',
          error
        );
      }
    },
  },

  debug:
    process.env.NODE_ENV ===
    'development',
};
