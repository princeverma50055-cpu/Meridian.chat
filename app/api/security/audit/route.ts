import { NextResponse } from 'next/server';

import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';

import {
  runSecurityAudit
} from '@/lib/security/audit';

import {
  getRequestId
} from '@/lib/security/request';

import {
  securityHeaders
} from '@/lib/security/headers';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  try {
    await getCurrentUserId();

    const audit = runSecurityAudit();

    const statusCode =
      audit.status === 'critical'
        ? 500
        : 200;

    return NextResponse.json(
      {
        ...audit,
        requestId
      },
      {
        status: statusCode,
        headers: securityHeaders(requestId)
      }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          error: 'Authentication required.'
        },
        {
          status: 401,
          headers: securityHeaders(requestId)
        }
      );
    }

    console.error(
      '[security/audit] failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'Security audit failed.'
      },
      {
        status: 500,
        headers: securityHeaders(requestId)
      }
    );
  }
}
