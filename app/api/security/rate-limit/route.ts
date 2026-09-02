import { NextResponse } from 'next/server';

import {
  getRequestId,
  getClientIp
} from '@/lib/security/request';

import {
  rateLimit,
  getRateLimitKey
} from '@/lib/security/rateLimit';

import {
  securityHeaders
} from '@/lib/security/headers';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  const ip = getClientIp(request);

  const result = rateLimit(
    getRateLimitKey(
      'security-test',
      ip
    ),
    {
      limit: 30,
      windowMs: 60_000
    }
  );

  const headers = securityHeaders(requestId);

  headers['X-RateLimit-Limit'] =
    String(result.limit);

  headers['X-RateLimit-Remaining'] =
    String(result.remaining);

  headers['X-RateLimit-Reset'] =
    String(Math.ceil(result.resetAt / 1000));

  if (!result.allowed) {
    return NextResponse.json(
      {
        error: 'Too many requests.',
        retryAfter: Math.max(
          Math.ceil(
            (result.resetAt - Date.now()) / 1000
          ),
          1
        )
      },
      {
        status: 429,
        headers: {
          ...headers,
          'Retry-After': String(
            Math.max(
              Math.ceil(
                (result.resetAt - Date.now()) /
                  1000
              ),
              1
            )
          )
        }
      }
    );
  }

  return NextResponse.json(
    {
      ok: true,
      limited: false,
      requestId
    },
    {
      status: 200,
      headers
    }
  );
}
