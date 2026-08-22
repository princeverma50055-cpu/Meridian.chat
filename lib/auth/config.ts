import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import CredentialsProvider from 'next-auth/providers/credentials';

/**
 * Central auth configuration. Passwords are never handled directly here —
 * CredentialsProvider.authorize() should call your own hashed-password
 * verification against the users table (e.g. via bcrypt), and Google OAuth
 * is enabled automatically once GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 * are present in the environment.
 */
export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
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
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as { id?: string }).id = token.sub;
      }
      return session;
    }
  }
};
