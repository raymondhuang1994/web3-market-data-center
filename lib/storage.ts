import { env } from 'cloudflare:workers';
export function reportStorage(): R2Bucket {
  const bucket = (env as unknown as { REPORTS?: R2Bucket }).REPORTS;
  if (!bucket) throw Error('Report storage unavailable');
  return bucket;
}
