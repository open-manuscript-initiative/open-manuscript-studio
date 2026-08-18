import { randomBytes } from 'node:crypto';

const HANDOFF_TTL_MS = 60_000;

interface HandoffEntry {
  expiresAt: number;
  payload: unknown;
}

const handoffs = new Map<string, HandoffEntry>();

function purgeExpired(now = Date.now()): void {
  for (const [token, entry] of handoffs) {
    if (entry.expiresAt <= now) handoffs.delete(token);
  }
}

export function createOjsHandoff(payload: unknown): string {
  purgeExpired();
  const token = randomBytes(32).toString('base64url');
  handoffs.set(token, {
    expiresAt: Date.now() + HANDOFF_TTL_MS,
    payload,
  });
  return token;
}

export function consumeOjsHandoff(token: string): unknown | undefined {
  purgeExpired();
  const entry = handoffs.get(token);
  if (!entry) return undefined;
  handoffs.delete(token);
  if (entry.expiresAt <= Date.now()) return undefined;
  return entry.payload;
}
