import { NextResponse } from 'next/server';
import {
  getCurrentUserId,
  UnauthorizedError
} from '@/lib/auth/currentUser';
import { exportUserData } from '@/lib/db/account';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const userId = await getCurrentUserId();

    const data = await exportUserData(userId);

    return new NextResponse(
      JSON.stringify(data, null, 2),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="meridian-data-export.json"',
          'Cache-Control': 'private, no-store, max-age=0',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    );
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json(
        {
          error: 'Authentication required'
        },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store'
          }
        }
      );
    }

    console.error(
      'Account export error:',
      error
    );

    return NextResponse.json(
      {
        error: 'Failed to export account data'
      },
      {
        status: 500,
        headers: {
          'Cache-Control': 'no-store'
        }
      }
    );
  }
}
