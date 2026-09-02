import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { projects } from '@/lib/db/schema';
import { requireUser } from '@/lib/auth/requireUser';
import {
  ValidationError,
  requireUuid,
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

  console.error('[projects/:id] API error:', error);

  return NextResponse.json(
    {
      error: 'Unable to process project request.',
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

async function getOwnedProject(
  projectId: string,
  userId: string
) {
  const db = getDb();

  const [project] = await db
    .select()
    .from(projects)
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.userId, userId)
      )
    )
    .limit(1);

  return project ?? null;
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
    const projectId = requireUuid(id, 'projectId');

    const project = await getOwnedProject(
      projectId,
      user.id
    );

    if (!project) {
      return NextResponse.json(
        {
          error: 'Project not found.',
        },
        {
          status: 404,
          headers: headers(),
        }
      );
    }

    return NextResponse.json(
      {
        project,
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
    const projectId = requireUuid(id, 'projectId');

    const existing = await getOwnedProject(
      projectId,
      user.id
    );

    if (!existing) {
      return NextResponse.json(
        {
          error: 'Project not found.',
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
      instructions?: string | null;
    } = {};

    if (raw.name !== undefined) {
      const name = cleanText(raw.name, 120);

      if (!name) {
        throw new ValidationError(
          'Project name cannot be empty.'
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

    if (raw.instructions !== undefined) {
      patch.instructions = cleanText(
        raw.instructions,
        10000
      );
    }

    if (Object.keys(patch).length === 0) {
      throw new ValidationError(
        'No valid project fields were provided.'
      );
    }

    const db = getDb();

    const [updated] = await db
      .update(projects)
      .set(patch)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, user.id)
        )
      )
      .returning();

    return NextResponse.json(
      {
        ok: true,
        project: updated,
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
    const projectId = requireUuid(id, 'projectId');

    const db = getDb();

    const [deleted] = await db
      .delete(projects)
      .where(
        and(
          eq(projects.id, projectId),
          eq(projects.userId, user.id)
        )
      )
      .returning({
        id: projects.id,
      });

    if (!deleted) {
      return NextResponse.json(
        {
          error: 'Project not found.',
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
