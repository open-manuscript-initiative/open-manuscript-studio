import { createHmac, timingSafeEqual } from 'node:crypto';

export const ROOM_ID = 'omi-sponsor-demo-synthetic-manuscript-v1';
const SESSION_SECONDS = 7200;

export function safeEqualSecret(expected, supplied) {
  const left = Buffer.from(String(expected || ''));
  const right = Buffer.from(String(supplied || ''));
  return left.length > 0 && left.length === right.length && timingSafeEqual(left, right);
}

export function createSessionToken(name, secret, now = Date.now()) {
  const displayName = String(name || '').trim().replace(/\s+/g, ' ').slice(0, 48);
  if (displayName.length < 2) throw new Error('Enter a display name of at least two characters.');
  if (Buffer.byteLength(secret || '') < 32) throw new Error('The signing secret must be at least 32 bytes.');
  const payload = Buffer.from(JSON.stringify({
    name: displayName,
    room: ROOM_ID,
    exp: Math.floor(now / 1000) + SESSION_SECONDS,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + signature;
}

export function verifySessionToken(token, secret, now = Date.now()) {
  if (typeof token !== 'string' || !secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const expected = createHmac('sha256', secret).update(parts[0]).digest('base64url');
  if (!safeEqualSecret(expected, parts[1])) return null;
  try {
    const value = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    if (value.room !== ROOM_ID || !Number.isInteger(value.exp) || value.exp <= Math.floor(now / 1000)) return null;
    if (typeof value.name !== 'string' || value.name.length < 2) return null;
    return value;
  } catch {
    return null;
  }
}
