import type { ModuleExecutionGrant } from '../../middleware/requireModuleCapability.js';
import { recognitionExecutionRepository as executions } from '../../repositories/recognitionExecutionRepository.js';
import { createHash, createHmac, timingSafeEqual } from 'node:crypto';
import { env } from '../../config/env.js';
import { prisma } from '../../lib/prisma.js';
import { decryptSecret, encryptSecret, type EncryptedSecret } from '../secretCrypto.js';
import { createTranskribusClient, validateTranskribusImage, TranskribusError, type TranskribusTokens } from './client.js';

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

export async function submitTranskribusJob(userId: string, modelId: number, imageBase64: string, grant: ModuleExecutionGrant, requestKey?: string) {
  if (!grant || grant.userId !== userId || grant.moduleId !== 'org.omi.critical-text-edition' ||
      grant.capability !== 'transkribus.recognize' || grant.expiresAt <= Date.now()) {
    throw new TranskribusError('TRANSKRIBUS_GRANT_REQUIRED', 403);
  }
  validateTranskribusImage(imageBase64);
  if (!Number.isInteger(modelId) || modelId < 1 || modelId > 2_147_483_647) throw new TranskribusError('TRANSKRIBUS_INVALID_REQUEST', 400);
  const stored = await connection(userId);
  const imageDigest = createHash('sha256').update(Buffer.from(imageBase64, 'base64')).digest('hex');
  const providerOrigin = env.TRANSKRIBUS_API_ORIGIN ?? 'https://api.transkribus.org';
  // Legacy callers get a deterministic key. V1 clients retain a UUID across uncertain retries.
  const key = requestKey ?? createHash('sha256').update(JSON.stringify([stored.id, modelId, imageDigest])).digest('hex');
  const where = { userId_workspaceId_requestKey: { userId, workspaceId: grant.workspaceId, requestKey: key } };
  const existing = await executions.findUnique({ where });
  if (existing) {
    if (existing.imageDigest !== imageDigest || existing.modelId !== modelId || existing.connectionId !== stored.id || existing.providerOrigin !== providerOrigin) throw new TranskribusError('TRANSKRIBUS_IDEMPOTENCY_CONFLICT', 409);
    if (existing.status === 'ACCEPTED' && existing.processId) return getTranskribusJob(userId, transkribusJobHandle(userId, existing.processId));
    throw new TranskribusError('TRANSKRIBUS_OUTCOME_UNKNOWN', 409);
  }
  // Refresh credentials before reserving a paid intent; no provider submission has happened yet.
  const access = await accessToken(userId);
  if (grant.expiresAt <= Date.now()) throw new TranskribusError('TRANSKRIBUS_GRANT_REQUIRED', 403);
  let intent;
  try {
    intent = await executions.create({ data: { userId, workspaceId: grant.workspaceId, requestKey: key,
      connectionId: stored.id, providerOrigin, modelId, imageDigest, grantId: grant.id,
      purpose: 'transcription', dataScope: 'uploaded-image', expiresAt: new Date(grant.expiresAt), status: 'SUBMITTING' } });
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002') throw new TranskribusError('TRANSKRIBUS_OUTCOME_UNKNOWN', 409);
    throw error;
  }
  try {
    // Never automatically retry a paid POST. A timeout is a durable unknown outcome.
    const job = await client().submit(access, modelId, imageBase64);
    await executions.update({ where: { id: intent.id }, data: { status: 'ACCEPTED', processId: job.processId } });
    return { ...job, handle: transkribusJobHandle(userId, job.processId) };
  } catch {
    await executions.updateMany({ where: { id: intent.id, status: 'SUBMITTING' }, data: { status: 'UNKNOWN' } });
    throw new TranskribusError('TRANSKRIBUS_OUTCOME_UNKNOWN', 409);
  }
}

export async function transkribusExecutionStatus(userId: string, workspaceId: string, requestKey: string) {
  const execution = await executions.findUnique({ where: { userId_workspaceId_requestKey: { userId, workspaceId, requestKey } } });
  if (!execution) throw new TranskribusError('TRANSKRIBUS_NOT_FOUND', 404);
  return { requestKey, status: execution.status === 'SUBMITTING' && execution.expiresAt.getTime() <= Date.now() ? 'UNKNOWN' : execution.status,
    ...(execution.processId ? { handle: transkribusJobHandle(userId, execution.processId) } : {}) };
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
