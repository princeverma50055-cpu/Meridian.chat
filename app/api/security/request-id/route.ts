import { NextResponse } from 'next/server';

import {
  getRequestId,
  getClientIp,
  getUserAgent
} from '@/lib/security/request';

import {
  securityHeaders
} from '@/lib/security/headers';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const requestId = getRequestId(request);

  return NextResponse.json(
    {
      ok: true,
      requestId,
      client: {
        ip: getClientIp(request),
        userAgent: getUserAgent(request)
      },
      timestamp: new Date().toISOString()
    },
    {
      status: 200,
      headers: securityHeaders(requestId)
    }
  );
}
