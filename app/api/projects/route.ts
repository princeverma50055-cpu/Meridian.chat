import { NextRequest, NextResponse } from 'next/server';
import { and, desc, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/requireUser';
import {
  ValidationError,
  validatePagination,
} from '@/lib/security/validation';

export const runtime = 'nodejs';

function responseHeaders() {
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
        headers: responseHeaders(),
      }
    );
  }

  console.error('[projects] API error:', error);

  return NextResponse.json(
    {
      error: 'Unable to process project request.',
    },
    {
      status: 500,
      headers: responseHeaders(),
    }
  );
}

function cleanText(
  value: unknown,
  maxLength: number
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== 'string') {
    throw new ValidationError(
      'Expected a text value.'
    );
  }

  const cleaned = value
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, maxLength);

  return cleaned || null;
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
      .from(projects)
      .where(eq(projects.userId, user.id))
      .orderBy(desc(projects.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json(
      {
        projects: rows,
        pagination: {
          page,
          pageSize,
          returned: rows.length,
        },
      },
      {
        status: 200,
        headers: responseHeaders(),
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
          headers: responseHeaders(),
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

    const name = cleanText(raw.name, 120);

    if (!name) {
      throw new ValidationError(
        'Project name is required.'
      );
    }

    const description = cleanText(
      raw.description,
      1000
    );

    const instructions = cleanText(
      raw.instructions,
      10000
    );

    const db = getDb();

    const [project] = await db
      .insert(projects)
      .values({
        userId: user.id,
        name,
        description,
        instructions,
      })
      .returning();

    return NextResponse.json(
      {
        ok: true,
        project,
      },
      {
        status: 201,
        headers: responseHeaders(),
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
          headers: responseHeaders(),
        }
      );
    }

    return errorResponse(error);
  }
}
