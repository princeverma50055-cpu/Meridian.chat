import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { users } from '@/lib/db/schema';

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  secret: process.env.AUTH_SECRET,
  pages: {
    signIn: '/login'
  },
  providers: [
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          })
        ]
      : []),
    CredentialsProvider({
      name: 'Email and password',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize() {
        throw new Error(
          'CredentialsProvider.authorize() is not implemented yet. Look up the user by email, ' +
            'verify the password against a bcrypt hash in the database, and return the user object ' +
            'or null. Never compare plaintext passwords.'
        );
      }
    })
  ],
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return true;
      try {
        const db = getDb();
        const existing = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        if (existing.length === 0) {
          await db.insert(users).values({
            email: user.email,
            name: user.name ?? undefined,
            avatarUrl: user.image ?? undefined
          });
        }
      } catch (err) {
        console.error('[auth] failed to upsert user on sign-in:', err);
      }
      return true;
    },

    async jwt({ token, user }) {
      if (user?.email) {
        try {
          const db = getDb();
          const rows = await db.select().from(users).where(eq(users.email, user.email)).limit(1);
          if (rows[0]) token.sub = rows[0].id;
        } catch (err) {
          console.error('[auth] failed to resolve user id in jwt callback:', err);
        }
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    }
  }
};
