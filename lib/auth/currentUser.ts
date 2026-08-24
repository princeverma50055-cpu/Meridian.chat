import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth/config';

/**
 * Resolves the logged-in user's id for API routes.
 *
 * KNOWN GAP: CredentialsProvider.authorize() in lib/auth/config.ts still
 * throws (see that file), so in practice no real session exists yet.
 * DEV_FALLBACK_USER_ID lets Phase 2 (conversation storage, streaming,
 * regenerate) be built and tested end-to-end without blocking on finishing
 * the login flow. Remove the fallback once authorize() is implemented —
 * search for DEV_FALLBACK_USER_ID before shipping this to real users.
 */
const DEV_FALLBACK_USER_ID = '00000000-0000-0000-0000-000000000001';

export async function getCurrentUserId(): Promise<string> {
  try {
    const session = await getServerSession(authOptions);
    const id = (session?.user as { id?: string } | undefined)?.id;
    return id ?? DEV_FALLBACK_USER_ID;
  } catch {
    // Session lookup can fail in preview/proxy environments even with
    // trustHost set — never let auth plumbing take down the whole request.
    return DEV_FALLBACK_USER_ID;
  }
}
