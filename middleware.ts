import { withAuth } from 'next-auth/middleware';

export default withAuth(
  function middleware() {
    return;
  },
  {
    pages: {
      signIn: '/login'
    },
    callbacks: {
      authorized: ({ token }) => {
        if (!token) {
          return false;
        }

        if (
          typeof token.sub !== 'string' ||
          !token.sub.trim()
        ) {
          return false;
        }

        if (
          typeof token.sessionId !== 'string' ||
          !token.sessionId.trim()
        ) {
          return false;
        }

        return true;
      }
    }
  }
);

export const config = {
  matcher: [
    '/',
    '/c/:path*',
    '/settings/:path*',
    '/projects/:path*',
    '/agents/:path*',
    '/library/:path*',
    '/search/:path*'
  ]
};
