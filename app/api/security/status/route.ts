import {
  NextResponse
} from 'next/server';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import {
  runSecurityAudit
} from '@/lib/security/audit';

import {
  getDb
} from '@/lib/db/client';

import {
  sql
} from 'drizzle-orm';

import {
  getRequestId
} from '@/lib/security/request';

import {
  securityHeaders
} from '@/lib/security/headers';

export const runtime =
  'nodejs';

export async function GET(
  request: Request
) {
  const requestId =
    getRequestId(request);

  try {
    await getCurrentUserId();

    let database =
      'unavailable';

    try {
      await getDb().execute(
        sql`select 1`
      );

      database =
        'connected';
    } catch (error) {
      console.error(
        '[security/status] database:',
        error
      );
    }

    const audit =
      runSecurityAudit();

    return NextResponse.json(
      {
        ok: true,
        service:
          'meridian-ai',
        database,
        security:
          audit.status,
        checks:
          audit.checks.map(
            check => ({
              name:
                check.name,
              status:
                check.status
            })
          ),
        timestamp:
          new Date().toISOString(),
        requestId
      },
      {
        status: 200,
        headers:
          securityHeaders(
            requestId
          )
      }
    );
  } catch (error) {
    if (
      error instanceof
      UnauthorizedError
    ) {
      return NextResponse.json(
        {
          error:
            'Authentication required.'
        },
        {
          status: 401,
          headers:
            securityHeaders(
              requestId
            )
        }
      );
    }

    console.error(
      '[security/status]',
      error
    );

    return NextResponse.json(
      {
        error:
          'Unable to read security status.'
      },
      {
        status: 500,
        headers:
          securityHeaders(
            requestId
          )
      }
    );
  }
}
