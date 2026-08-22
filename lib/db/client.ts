import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Server-side only. Reads DATABASE_URL from the environment — never
 * bundle this file into client components.
 */
function createClient() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set. Configure it in .env.local (see .env.example).');
  }
  const queryClient = postgres(connectionString, { max: 5 });
  return drizzle(queryClient, { schema });
}

let cached: ReturnType<typeof createClient> | null = null;

export function getDb() {
  if (!cached) cached = createClient();
  return cached;
}
