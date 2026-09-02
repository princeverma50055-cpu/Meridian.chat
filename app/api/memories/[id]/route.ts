import { NextRequest, NextResponse } from 'next/server';
import { and, eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import { memories } from '@/lib/db/schema';
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

  console.error('[memories/:id] API error:', error);

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
    const memoryId = requireUuid(id, 'memoryId');

    const db = getDb();

    const [deleted] = await db
      .delete(memories)
      .where(
        and(
          eq(memories.id, memoryId),
          eq(memories.userId, user.id)
        )
      )
      .returning({
        id: memories.id,
      });

    if (!deleted) {
      return NextResponse.json(
        {
          error: 'Memory not found.',
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
