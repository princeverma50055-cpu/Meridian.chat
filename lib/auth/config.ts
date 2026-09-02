import type { NextAuthOptions, User } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { eq, and, gt } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '@/lib/db/client';
import { users, profiles, authSessions } from '@/lib/db/schema';
import { verifyPassword } from '@/lib/auth/password';

const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type MeridianToken = {
  sub?: string;
  sessionId?: string;
  email?: string;
  name?: string;
  picture?: string;
  iat?: number;
  exp?: number;
  jti?: string;
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
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();

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
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail) {
    return null;
  }

  const db = getDb();

  const [existingUser] = await db
    .select({
      id: users.id,
      name: users.name,
      avatarUrl: users.avatarUrl
    })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);

  let userId = existingUser?.id;

  if (!userId) {
    const [createdUser] = await db
      .insert(users)
      .values({
        email: normalizedEmail,
        name: name?.trim() || undefined,
        avatarUrl: image?.trim() || undefined
      })
      .returning({
        id: users.id
      });

    userId = createdUser?.id;
  } else if (name || image) {
    await db
      .update(users)
      .set({
        ...(name ? { name: name.trim() } : {}),
        ...(image ? { avatarUrl: image.trim() } : {})
      })
      .where(eq(users.id, userId));
  }

  if (!userId) {
    return null;
  }

  const [profile] = await db
    .select({
      userId: profiles.userId
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
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
      expiresAt
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

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,

  session: {
    strategy: 'jwt',
    maxAge: SESSION_MAX_AGE_SECONDS,
    updateAge: 24 * 60 * 60
  },

  pages: {
    signIn: '/login'
  },

  providers: [
    ...(getConfiguredGoogleProvider()
      ? [getConfiguredGoogleProvider()!]
      : []),

    CredentialsProvider({
      id: 'credentials',
      name: 'Email and password',

      credentials: {
        email: {
          label: 'Email',
          type: 'email',
          placeholder: 'you@example.com'
        },
        password: {
          label: 'Password',
          type: 'password'
        }
      },

      async authorize(credentials) {
        if (
          !credentials?.email ||
          !credentials.password
        ) {
          return null;
        }

        const email = normalizeEmail(
          credentials.email
        );

        if (!email) {
          return null;
        }

        const db = getDb();

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (
          !user?.passwordHash ||
          !verifyPassword(
            credentials.password,
            user.passwordHash
          )
        ) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.avatarUrl
        } satisfies User;
      }
    })
  ],

  callbacks: {
    async signIn({
      user,
      account
    }) {
      if (!user.email) {
        return false;
      }

      try {
        const userId = await provisionUser(
          user.email,
          user.name,
          user.image
        );

        if (!userId) {
          console.error(
            '[auth] Unable to provision user.'
          );

          return false;
        }

        user.id = userId;

        if (
          account?.provider === 'google'
        ) {
          console.info(
            '[auth] Google sign-in successful.'
          );
        }

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
        typedToken.sub = user.id;
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

      if (
        typedToken.sub &&
        !typedToken.sessionId
      ) {
        try {
          typedToken.sessionId =
            await createDatabaseSession(
              typedToken.sub
            );
        } catch (error) {
          console.error(
            '[auth] Failed to create database session:',
            error
          );

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

      if (
        !typedToken.sub ||
        !typedToken.sessionId
      ) {
        return {
          ...session,
          user: undefined
        };
      }

      const active =
        await isDatabaseSessionActive(
          typedToken.sessionId,
          typedToken.sub
        );

      if (!active) {
        return {
          ...session,
          user: undefined
        };
      }

      sessionUser.id =
        typedToken.sub;

      sessionUser.sessionId =
        typedToken.sessionId;

      if (
        typedToken.email
      ) {
        sessionUser.email =
          typedToken.email;
      }

      if (
        typedToken.name
      ) {
        sessionUser.name =
          typedToken.name;
      }

      if (
        typedToken.picture
      ) {
        sessionUser.image =
          typedToken.picture;
      }

      return session;
    }
  },

  events: {
    async signOut({
      token
    }) {
      const typedToken =
        token as MeridianToken | undefined;

      const sessionId =
        typedToken?.sessionId;

      if (!sessionId) {
        return;
      }

      try {
        const db = getDb();

        await db
          .delete(authSessions)
          .where(
            eq(
              authSessions.id,
              sessionId
            )
          );
      } catch (error) {
        console.error(
          '[auth] Failed to revoke database session during sign-out:',
          error
        );
      }
    }
  }
};
