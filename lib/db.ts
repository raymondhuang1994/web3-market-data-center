import { env } from 'cloudflare:workers';
export function db(): D1Database {
  const value = (env as unknown as { DB?: D1Database }).DB;
  if (!value) throw new Error('Database unavailable');
  return value;
}
