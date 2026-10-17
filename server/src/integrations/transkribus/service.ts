import { createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '../secretCrypto.js';
import { createTranskribusClient, TranskribusError, type TranskribusTokens } from './client.js';

const identity = (userId: string) => ({ userId, providerId: 'transkribus', connectionKey: 'personal' });
const refreshing = new Map<string, Promise<void>>();

function client() {
  return createTranskribusClient({ apiOrigin: env.TRANSKRIBUS_API_ORIGIN });
}

async function connection(userId: string) {
  const stored = await prisma.userIntegration.findUnique({ where: { userId_providerId_connectionKey: identity(userId) } });
  if (!stored?.enabled || !stored.encryptedSecret) throw new TranskribusError('TRANSKRIBUS_RECONNECT', 409);
  return stored;
}

function decodeTokens(secret: string): TranskribusTokens {
  try {
    const tokens = JSON.parse(decryptSecret(JSON.parse(secret) as EncryptedSecret)) as TranskribusTokens;
    if (!tokens.accessToken || !tokens.refreshToken || !Number.isFinite(tokens.expiresAt)) throw new Error();
    return tokens;
  } catch { throw new TranskribusError('TRANSKRIBUS_RECONNECT', 409); }
}

export async function transkribusConnectionStatus(userId: string) {
  const stored = await prisma.userIntegration.findUnique({ where: { userId_providerId_connectionKey: identity(userId) } });
  return { connected: Boolean(stored?.enabled && stored.encryptedSecret), accountLabel: stored?.displayName ?? '' };
}

export async function testTranskribusConnection(userId: string) {
  const status = await transkribusConnectionStatus(userId);
  if (!status.connected) return { configured: false, healthy: false, message: 'Connect Transkribus in the integration settings.' };
  try {
    await accessToken(userId);
    return { configured: true, healthy: true, message: 'Transkribus credentials are available. Processing requires API access and credits.' };
  } catch {
    return { configured: true, healthy: false, message: 'Reconnect the Transkribus account.' };
  }
}

export async function connectTranskribus(userId: string, username: string, password: string): Promise<void> {
  const tokens = await client().login(username, password);
  const encryptedSecret = JSON.stringify(encryptSecret(JSON.stringify(tokens)));
  // Only tokens are persisted. The password is used once for the documented OIDC exchange.
  const data = { displayName: username, authenticationMode: 'oidc', enabled: true,
    encryptedSecret, status: 'CONNECTED', lastCheckedAt: new Date(), lastError: null };
  await prisma.userIntegration.upsert({
    where: { userId_providerId_connectionKey: identity(userId) },
    create: { ...identity(userId), ...data }, update: data,
  });
}

export async function disconnectTranskribus(userId: string): Promise<void> {
  const stored = await prisma.userIntegration.findUnique({ where: { userId_providerId_connectionKey: identity(userId) } });
  // Clear locally first; an unavailable identity provider must not prevent disconnecting.
  await prisma.userIntegration.deleteMany({ where: identity(userId) });
  if (stored?.encryptedSecret) {
    try { await client().logout(decodeTokens(stored.encryptedSecret).refreshToken); }
    catch { /* Local credentials have already been removed. */ }
  }
}

async function accessToken(userId: string, forceRefresh = false): Promise<string> {
  const stored = await connection(userId);
  const tokens = decodeTokens(stored.encryptedSecret!);
  if (!forceRefresh && tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken;
  let pending = refreshing.get(userId);
  if (!pending) {
    pending = (async () => {
      const next = await client().refresh(tokens.refreshToken);
      const saved = await prisma.userIntegration.updateMany({
        where: { id: stored.id, userId, enabled: true, encryptedSecret: stored.encryptedSecret },
        data: { encryptedSecret: JSON.stringify(encryptSecret(JSON.stringify(next))), lastCheckedAt: new Date() },
      });
      if (!saved.count) throw new TranskribusError('TRANSKRIBUS_RECONNECT', 409);
    })().finally(() => { refreshing.delete(userId); });
    refreshing.set(userId, pending);
  }
  await pending;
  const latest = await connection(userId);
  return decodeTokens(latest.encryptedSecret!).accessToken;
}

function signature(userId: string, processId: number): string {
  return createHmac('sha256', Buffer.from(env.INTEGRATION_MASTER_KEY, 'hex'))
    .update(JSON.stringify(['transkribus-job-v1', userId, processId])).digest('base64url');
}

/** A job handle is bound to the Studio account; upstream IDs alone grant no access. */
export function transkribusJobHandle(userId: string, processId: number): string {
  return `${processId}.${signature(userId, processId)}`;
}

export function verifyTranskribusJobHandle(userId: string, handle: string): number {
  const match = /^([1-9]\d{0,15})\.([A-Za-z0-9_-]{43})$/.exec(handle);
  const processId = Number(match?.[1]);
  if (!match || !Number.isSafeInteger(processId)) throw new TranskribusError('TRANSKRIBUS_INVALID_JOB', 404);
  const expected = Buffer.from(signature(userId, processId));
  const actual = Buffer.from(match[2]!);
  if (!timingSafeEqual(expected, actual)) throw new TranskribusError('TRANSKRIBUS_INVALID_JOB', 404);
  return processId;
}

export async function submitTranskribusJob(userId: string, modelId: number, imageBase64: string) {
  // Never retry submissions: an ambiguous network failure may already have consumed credits.
  const job = await client().submit(await accessToken(userId), modelId, imageBase64);
  return { ...job, handle: transkribusJobHandle(userId, job.processId) };
}

async function readWithRefresh<T>(userId: string, read: (token: string) => Promise<T>): Promise<T> {
  try { return await read(await accessToken(userId)); }
  catch (error) {
    if (!(error instanceof TranskribusError) || error.code !== 'TRANSKRIBUS_RECONNECT') throw error;
    return read(await accessToken(userId, true));
  }
}

export async function getTranskribusJob(userId: string, handle: string) {
  const processId = verifyTranskribusJobHandle(userId, handle);
  const job = await readWithRefresh(userId, token => client().getJob(token, processId));
  return { ...job, handle };
}

export async function getTranskribusPageXml(userId: string, handle: string): Promise<string> {
  const processId = verifyTranskribusJobHandle(userId, handle);
  return readWithRefresh(userId, token => client().getPageXml(token, processId));
}
