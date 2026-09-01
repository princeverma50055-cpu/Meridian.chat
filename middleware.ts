import { withAuth } from "next-auth/middleware";

export default withAuth;

/**
 * Every page except /login itself requires a signed-in session. API routes
 * are left unprotected here since they check the session/userId internally,
 * but the UI never reaches them without first passing through this gate.
 */
export const config = {
  matcher: ['/', '/c/:path*', '/settings', '/projects', '/agents', '/library'],
};
