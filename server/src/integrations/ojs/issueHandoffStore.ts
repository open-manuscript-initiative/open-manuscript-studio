import { randomBytes } from 'node:crypto';

const TTL_MS = 10 * 60_000;
const MAX_PENDING = 8;
const MAX_BYTES = 64 * 1024 * 1024;

const pending = new Map<string, { payload: string; bytes: number; expiresAt: number }>();
let totalBytes = 0;

function remove(token: string): void {
  const entry = pending.get(token);
  if (!entry) return;
  totalBytes -= entry.bytes;
  pending.delete(token);
}

function purge(): void {
  const now = Date.now();
  for (const [token, entry] of pending) {
    if (entry.expiresAt <= now) remove(token);
  }
}

export function createOjsIssueHandoff(data: unknown): string {
  purge();
  const payload = JSON.stringify(data);
  const bytes = Buffer.byteLength(payload, 'utf8');
  if (pending.size >= MAX_PENDING || totalBytes + bytes > MAX_BYTES) {
    throw new Error('Too many pending OJS issue imports. Retry after completing an existing import.');
  }
  const token = randomBytes(32).toString('base64url');
  pending.set(token, { payload, bytes, expiresAt: Date.now() + TTL_MS });
  totalBytes += bytes;
  return token;
}

export function consumeOjsIssueHandoff(token: string): string | undefined {
  purge();
  const entry = pending.get(token);
  if (!entry) return undefined;
  remove(token);
  return entry.payload;
}
