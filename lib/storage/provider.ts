import { put, del } from '@vercel/blob';

export interface StorageProvider {
  save(buffer: Buffer, fileName: string): Promise<string>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class VercelBlobStorageProvider implements StorageProvider {
  async save(buffer: Buffer, fileName: string): Promise<string> {
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitize(fileName)}`;
    const blob = await put(key, buffer, {
      access: 'public',
      addRandomSuffix: false
    });
    return blob.url;
  }

  async read(key: string): Promise<Buffer> {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    const res = await fetch(key, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    });
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
