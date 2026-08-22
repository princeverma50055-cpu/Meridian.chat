import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { listFilesForUser } from '@/lib/db/files';

export async function GET() {
  try {
    const userId = await getCurrentUserId();
    const rows = await listFilesForUser(userId);
    return NextResponse.json({ files: rows });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load files' },
      { status: 500 }
    );
  }
}
