import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
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
    const db = getDb();

    await db.execute(sql`select 1`);

    return NextResponse.json(
      {
        ok: true,
        status: 'healthy',
        service: 'meridian-ai',
        database: 'connected',
        timestamp: new Date().toISOString()
      },
      {
        status: 200,
        headers: securityHeaders(requestId)
      }
    );
  } catch (error) {
    console.error(
      '[health] database check failed:',
      error
    );

    return NextResponse.json(
      {
        ok: false,
        status: 'unhealthy',
        service: 'meridian-ai',
        database: 'unavailable',
        timestamp: new Date().toISOString()
      },
      {
        status: 503,
        headers: securityHeaders(requestId)
      }
    );
  }
}
