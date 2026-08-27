import { put, del } from '@vercel/blob';

export interface StorageProvider {
  /** Saves a buffer under a generated key and returns the key. */
  save(buffer: Buffer, fileName: string): Promise<string>;
  /** Reads a previously saved file back into memory. */
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/**
 * Vercel Blob storage (private access — files aren't publicly reachable by
 * URL alone). Works both locally (via BLOB_READ_WRITE_TOKEN in .env.local)
 * and in production on Vercel, where the filesystem is read-only/ephemeral
 * and can't be used for uploads.
 */
class VercelBlobStorageProvider implements StorageProvider {
  async save(buffer: Buffer, fileName: string): Promise<string> {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitize(fileName)}`;
    const blob = await put(key, buffer, {
      access: 'private',
      addRandomSuffix: false
    });
    return blob.url;
  }

  async read(key: string): Promise<Buffer> {
    const res = await fetch(key);
    if (!res.ok) {
      throw new Error(`Failed to read file from storage (${res.status})`);
    }
    const arrayBuffer = await res.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async delete(key: string): Promise<void> {
    await del(key);
  }
}

function sanitize(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (!cached) cached = new VercelBlobStorageProvider();
  return cached;
}
