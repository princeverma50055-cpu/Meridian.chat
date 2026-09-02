import { NextRequest, NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/requireUser';
import {
  ValidationError,
  validateModelId,
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

  console.error('[agents] API error:', error);

  return NextResponse.json(
    {
      error: 'Unable to process agent request.',
    },
    {
      status: 500,
      headers: headers(),
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

function validateVisibility(
  value: unknown,
  defaultValue = 'private'
): string {
  if (value === undefined || value === null) {
    return defaultValue;
  }

  if (
    value !== 'private' &&
    value !== 'public'
  ) {
    throw new ValidationError(
      'Visibility must be either private or public.'
    );
  }

  return value;
}

function validateAvatarUrl(
  value: unknown
): string | null {
  const url = cleanText(value, 2000);

  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);

    if (
      parsed.protocol !== 'https:' &&
      parsed.protocol !== 'http:'
    ) {
      throw new Error();
    }

    return parsed.toString();
  } catch {
    throw new ValidationError(
      'avatarUrl must be a valid HTTP or HTTPS URL.'
    );
  }
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
      .from(agents)
      .where(eq(agents.userId, user.id))
      .orderBy(desc(agents.createdAt))
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json(
      {
        agents: rows,
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

    const name = cleanText(raw.name, 120);

    if (!name) {
      throw new ValidationError(
        'Agent name is required.'
      );
    }

    const description = cleanText(
      raw.description,
      1000
    );

    const systemInstructions = cleanText(
      raw.systemInstructions,
      20000
    );

    const model = validateModelId(raw.model);

    const avatarUrl = validateAvatarUrl(
      raw.avatarUrl
    );

    const visibility = validateVisibility(
      raw.visibility
    );

    const db = getDb();

    const [agent] = await db
      .insert(agents)
      .values({
        userId: user.id,
        name,
        description,
        systemInstructions,
        model,
        avatarUrl,
        visibility,
      })
      .returning();

    return NextResponse.json(
      {
        ok: true,
        agent,
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
