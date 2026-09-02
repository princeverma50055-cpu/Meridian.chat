import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { agents } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/requireUser';
import {
  ValidationError,
  requireUuid,
  validateModelId,
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

  console.error('[agents/:id] API error:', error);

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
  value: unknown
): string {
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

async function getOwnedAgent(
  agentId: string,
  userId: string
) {
  const db = getDb();

  const [agent] = await db
    .select()
    .from(agents)
    .where(
      and(
        eq(agents.id, agentId),
        eq(agents.userId, userId)
      )
    )
    .limit(1);

  return agent ?? null;
}

export async function GET(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await requireUser();

    const { id } = await params;
    const agentId = requireUuid(id, 'agentId');

    const agent = await getOwnedAgent(
      agentId,
      user.id
    );

    if (!agent) {
      return NextResponse.json(
        {
          error: 'Agent not found.',
        },
        {
          status: 404,
          headers: headers(),
        }
      );
    }

    return NextResponse.json(
      {
        agent,
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

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await requireUser();

    const { id } = await params;
    const agentId = requireUuid(id, 'agentId');

    const existing = await getOwnedAgent(
      agentId,
      user.id
    );

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Agent not found.',
        },
        {
          status: 404,
          headers: headers(),
        }
      );
    }

    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      throw new ValidationError(
        'Invalid request body.'
      );
    }

    const raw = body as Record<string, unknown>;

    const patch: {
      name?: string;
      description?: string | null;
      systemInstructions?: string | null;
      model?: string;
      avatarUrl?: string | null;
      visibility?: string;
    } = {};

    if (raw.name !== undefined) {
      const name = cleanText(raw.name, 120);

      if (!name) {
        throw new ValidationError(
          'Agent name cannot be empty.'
        );
      }

      patch.name = name;
    }

    if (raw.description !== undefined) {
      patch.description = cleanText(
        raw.description,
        1000
      );
    }

    if (raw.systemInstructions !== undefined) {
      patch.systemInstructions = cleanText(
        raw.systemInstructions,
        20000
      );
    }

    if (raw.model !== undefined) {
      patch.model = validateModelId(raw.model);
    }

    if (raw.avatarUrl !== undefined) {
      patch.avatarUrl = validateAvatarUrl(
        raw.avatarUrl
      );
    }

    if (raw.visibility !== undefined) {
      patch.visibility = validateVisibility(
        raw.visibility
      );
    }

    if (Object.keys(patch).length === 0) {
      throw new ValidationError(
        'No valid agent fields were provided.'
      );
    }

    const db = getDb();

    const [updated] = await db
      .update(agents)
      .set(patch)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.userId, user.id)
        )
      )
      .returning();

    return NextResponse.json(
      {
        ok: true,
        agent: updated,
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

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string }>;
  }
) {
  try {
    const user = await requireUser();

    const { id } = await params;
    const agentId = requireUuid(id, 'agentId');

    const db = getDb();

    const [deleted] = await db
      .delete(agents)
      .where(
        and(
          eq(agents.id, agentId),
          eq(agents.userId, user.id)
        )
      )
      .returning({
        id: agents.id,
      });

    if (!deleted) {
      return NextResponse.json(
        {
          error: 'Agent not found.',
        },
        {
          status: 404,
          headers: headers(),
        }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        deletedId: deleted.id,
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
