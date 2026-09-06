import {
  NextRequest,
  NextResponse
} from 'next/server';

import { eq } from 'drizzle-orm';

import { getDb } from '@/lib/db/client';
import {
  users,
  profiles
} from '@/lib/db/schema';

import {
  isUnauthorizedError,
  requireUserId
} from '@/lib/auth/requireUser';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const MAX_NAME_LENGTH = 120;

function isPlainObject(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value)
  );
}

async function ensureProfile(
  userId: string
) {
  const db = getDb();

  const [existing] = await db
    .select({
      userId: profiles.userId,
      plan: profiles.plan,
      preferences: profiles.preferences,
      updatedAt: profiles.updatedAt
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  if (existing) {
    return existing;
  }

  const [created] = await db
    .insert(profiles)
    .values({
      userId
    })
    .onConflictDoNothing()
    .returning({
      userId: profiles.userId,
      plan: profiles.plan,
      preferences: profiles.preferences,
      updatedAt: profiles.updatedAt
    });

  if (created) {
    return created;
  }

  const [afterRace] = await db
    .select({
      userId: profiles.userId,
      plan: profiles.plan,
      preferences: profiles.preferences,
      updatedAt: profiles.updatedAt
    })
    .from(profiles)
    .where(eq(profiles.userId, userId))
    .limit(1);

  return (
    afterRace ?? {
      userId,
      plan: 'free',
      preferences: {},
      updatedAt: new Date()
    }
  );
}

export async function GET() {
  try {
    const userId = await requireUserId();

    const db = getDb();

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return NextResponse.json(
        {
          error: 'NOT_FOUND',
          message:
            'Your account could not be found.'
        },
        {
          status: 404,
          headers
        }
      );
    }

    const profile =
      await ensureProfile(userId);

    return NextResponse.json(
      {
        ok: true,
        user,
        profile
      },
      {
        headers
      }
    );
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: error.message
        },
        {
          status: 401,
          headers
        }
      );
    }

    console.error(
      '[profile] GET failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        message:
          'Unable to load your profile right now. Please try again in a moment.'
      },
      {
        status: 500,
        headers
      }
    );
  }
}

export async function PATCH(
  req: NextRequest
) {
  try {
    const userId = await requireUserId();

    let body: unknown;

    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message:
            'Request body must be valid JSON.'
        },
        {
          status: 400,
          headers
        }
      );
    }

    if (!isPlainObject(body)) {
      return NextResponse.json(
        {
          error: 'INVALID_BODY',
          message:
            'Request body must be a JSON object.'
        },
        {
          status: 400,
          headers
        }
      );
    }

    const { name, preferences } =
      body as {
        name?: unknown;
        preferences?: unknown;
      };

    const db = getDb();

    if (name !== undefined) {
      if (
        typeof name !== 'string' ||
        name.trim().length === 0 ||
        name.trim().length >
          MAX_NAME_LENGTH
      ) {
        return NextResponse.json(
          {
            error: 'INVALID_NAME',
            message: `Name must be between 1 and ${MAX_NAME_LENGTH} characters.`
          },
          {
            status: 400,
            headers
          }
        );
      }

      await db
        .update(users)
        .set({
          name: name.trim()
        })
        .where(eq(users.id, userId));
    }

    if (preferences !== undefined) {
      if (!isPlainObject(preferences)) {
        return NextResponse.json(
          {
            error: 'INVALID_PREFERENCES',
            message:
              'Preferences must be a JSON object.'
          },
          {
            status: 400,
            headers
          }
        );
      }

      const current =
        await ensureProfile(userId);

      const currentPreferences =
        isPlainObject(
          current.preferences
        )
          ? current.preferences
          : {};

      const mergedPreferences = {
        ...currentPreferences,
        ...preferences
      };

      await db
        .insert(profiles)
        .values({
          userId,
          preferences: mergedPreferences,
          updatedAt: new Date()
        })
        .onConflictDoUpdate({
          target: profiles.userId,
          set: {
            preferences: mergedPreferences,
            updatedAt: new Date()
          }
        });
    }

    const [user] = await db
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        avatarUrl: users.avatarUrl
      })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const profile =
      await ensureProfile(userId);

    return NextResponse.json(
      {
        ok: true,
        user,
        profile
      },
      {
        headers
      }
    );
  } catch (error) {
    if (isUnauthorizedError(error)) {
      return NextResponse.json(
        {
          error: 'UNAUTHORIZED',
          message: error.message
        },
        {
          status: 401,
          headers
        }
      );
    }

    console.error(
      '[profile] PATCH failed:',
      error
    );

    return NextResponse.json(
      {
        error: 'SERVER_ERROR',
        message:
          'Unable to save your settings right now. Please try again in a moment.'
      },
      {
        status: 500,
        headers
      }
    );
  }
}
