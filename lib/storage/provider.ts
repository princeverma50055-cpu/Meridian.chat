import { promises as fs } from 'fs';
import path from 'path';

export interface StorageProvider {
  /** Saves a buffer under a generated key and returns the key. */
  save(buffer: Buffer, fileName: string): Promise<string>;
  /** Reads a previously saved file back into memory. */
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

/**
 * Local-disk storage for development only. Files live under
 * ./storage/uploads (gitignored) so nothing here survives a real
 * deployment's ephemeral filesystem (e.g. Vercel serverless functions).
 *
 * Swap this for a real object-storage provider (S3, Cloudflare R2, Supabase
 * Storage) before shipping — implement StorageProvider against STORAGE_KEY /
 * STORAGE_BUCKET from .env and return getStorageProvider() from there
 * instead once configured.
 */
class LocalDiskStorageProvider implements StorageProvider {
  private root = path.join(process.cwd(), 'storage', 'uploads');

  private async ensureRoot() {
    await fs.mkdir(this.root, { recursive: true });
  }

  async save(buffer: Buffer, fileName: string): Promise<string> {
    await this.ensureRoot();
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${sanitize(fileName)}`;
    await fs.writeFile(path.join(this.root, key), buffer);
    return key;
  }

  async read(key: string): Promise<Buffer> {
    return fs.readFile(path.join(this.root, key));
  }

  async delete(key: string): Promise<void> {
    await fs.rm(path.join(this.root, key), { force: true });
  }
}

function sanitize(fileName: string): string {
  return fileName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-80);
}

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  const configured = process.env.STORAGE_KEY;
  if (!configured) {
    // Not throwing here (unlike the AI provider) because local disk storage
    // is a legitimate, working default for development — just not durable
    // in a real serverless deployment. See class comment above.
    if (!cached) cached = new LocalDiskStorageProvider();
    return cached;
  }
  throw new Error(
    'STORAGE_KEY is set but no cloud storage provider is implemented yet. Add one in ' +
      'lib/storage/provider.ts implementing StorageProvider (e.g. S3/R2/Supabase Storage).'
  );
}
