import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { memories } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/requireUser';
import {
  ValidationError,
  validateMemoryContent,
  validatePagination,
} from '@/lib/security/validation';

export const runtime = 'nodejs';

function headers() {
  return {
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  };
}

function errorResponse(error: unknown) {
  if (error instanceof ValidationError) {
    return NextResponse.json(
      {
        error: error.message,
        issues: error.issues,
      },
      {
        status: 400,
        headers: headers(),
      }
    );
  }

  console.error('[memories] API error:', error);

  return NextResponse.json(
    {
      error: 'Unable to process memory request.',
    },
    {
      status: 500,
      headers: headers(),
    }
  );
}

export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();

    const { page, pageSize, offset } =
      validatePagination(
        request.nextUrl.searchParams.get('page'),
        request.nextUrl.searchParams.get('pageSize')
      );

    const db = getDb();

    const rows = await db
      .select()
      .from(memories)
      .where(eq(memories.userId, user.id))
      .orderBy(desc(memories.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json(
      {
        memories: rows,
        pagination: {
          page,
          pageSize,
          returned: rows.length,
        },
      },
      {
        status: 200,
        headers: headers(),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      'status' in error &&
      (error as { status?: number }).status === 401
    ) {
      return NextResponse.json(
        {
          error: 'Authentication required.',
        },
        {
          status: 401,
          headers: headers(),
        }
      );
    }

    return errorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      throw new ValidationError(
        'Invalid request body.'
      );
    }

    const raw = body as Record<string, unknown>;

    const content = validateMemoryContent(
      raw.content
    );

    const db = getDb();

    const [memory] = await db
      .insert(memories)
      .values({
        userId: user.id,
        content,
      })
      .returning();

    return NextResponse.json(
      {
        ok: true,
        memory,
      },
      {
        status: 201,
        headers: headers(),
      }
    );
  } catch (error) {
    if (
      error instanceof Error &&
      'status' in error &&
      (error as { status?: number }).status === 401
    ) {
      return NextResponse.json(
        {
          error: 'Authentication required.',
        },
        {
          status: 401,
          headers: headers(),
        }
      );
    }

    return errorResponse(error);
  }
}
