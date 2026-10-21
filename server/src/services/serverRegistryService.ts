import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';

import { z } from 'zod';

import { serverRegistryRepository as repository } from '../repositories/serverRegistryRepository.js';
import { submitGithubRegistration } from '../serverRegistry/githubAudit.js';

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(100),
  origin: z.string().trim().url().max(512),
  softwareVersion: z.string().trim().max(80).optional(),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(40).default([]),
}).strict();

const heartbeatSchema = z.object({
  softwareVersion: z.string().trim().max(80).optional(),
  capabilities: z.array(z.string().trim().min(1).max(64)).max(40).optional(),
}).strict();

const digest = (value: string) => createHash('sha256').update(value).digest('hex');


function normalizePublicOrigin(value: string): { origin: string; hostname: string } {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash ||
    isIP(hostname) !== 0 ||
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local')
  ) {
    throw new Error('Server origins must be public HTTPS origins without a path.');
  }
  return { origin: url.origin, hostname };
}

function bearerToken(header: string | undefined): string | null {
  const match = header?.match(/^Bearer ([A-Za-z0-9_-]{40,})$/);
  return match?.[1] ?? null;
}

function tokenMatches(presented: string, storedHash: string): boolean {
  const candidate = Buffer.from(digest(presented), 'hex');
  const expected = Buffer.from(storedHash, 'hex');
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

export interface RegistryResult { status: number; body?: unknown }

export async function register(input: unknown = {}): Promise<RegistryResult> {
  const parsed = registrationSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 400, body: { error: { code: 'INVALID_REGISTRATION', message: 'Registration details are invalid.' } } };
  }

  let normalized: { origin: string; hostname: string };
  try {
    normalized = normalizePublicOrigin(parsed.data.origin);
  } catch (error) {
    return { status: 400, body: { error: { code: 'INVALID_SERVER_ORIGIN', message: error instanceof Error ? error.message : 'Invalid server origin.' } } };
  }

  const existing = await repository.findByOrigin(normalized.origin);
  if (existing && existing.status !== 'REVOKED' && !(existing.status === 'PENDING' && existing.challengeExpiresAt && existing.challengeExpiresAt.getTime() <= Date.now())) {
    return { status: 409, body: { error: { code: 'SERVER_ALREADY_REGISTERED', message: 'This server is already registered or awaiting verification.' } } };
  }

  const id = existing?.id ?? randomBytes(16).toString('hex');
  const registrationToken = randomBytes(32).toString('base64url');
  const challenge = randomBytes(24).toString('base64url');
  const heartbeatToken = randomBytes(32).toString('base64url');
  const data = {
    name: parsed.data.name,
    origin: normalized.origin,
    hostname: normalized.hostname,
    status: 'PENDING' as const,
    domainChallengeHash: digest(challenge),
    registrationTokenHash: digest(registrationToken),
    challengeExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    heartbeatTokenHash: digest(heartbeatToken),
    ...(parsed.data.softwareVersion ? { softwareVersion: parsed.data.softwareVersion } : {}),
    capabilities: parsed.data.capabilities,
    verifiedAt: null,
    lastHeartbeatAt: null,
    githubIssueUrl: null,
  };
  if (!await repository.register(id, data, Boolean(existing))) return { status: 409, body: { error: { code: 'SERVER_ALREADY_REGISTERED' } } };

  return { status: 201, body: {
    id,
    registrationToken,
    expiresAt: data.challengeExpiresAt.toISOString(),
    status: 'pending_domain_verification',
    verification: {
      type: 'dns-txt',
      name: `_omi-studio-verification.${normalized.hostname}`,
      value: challenge,
    },
    heartbeatIntervalSeconds: 300,
    instructions: 'Publish the DNS TXT record, then call POST /api/v1/server-registry/registrations/{id}/verify. Store the heartbeat token only on the server.',
  } };
}

export async function verify(_input: unknown = {}, id = '', authorization?: string): Promise<RegistryResult> {
  const token = bearerToken(authorization);
  const entry = await repository.findById(id);
  if (!entry || !token || !entry.registrationTokenHash || !tokenMatches(token, entry.registrationTokenHash)) {
    return { status: 401, body: { error: { code: 'REGISTRATION_PROOF_REQUIRED' } } };
  }
  if (entry.status !== 'PENDING' || !entry.challengeExpiresAt || entry.challengeExpiresAt.getTime() <= Date.now()) {
    return { status: 409, body: { error: { code: 'REGISTRATION_EXPIRED_OR_CONSUMED' } } };
  }
  let records: string[][];
  try {
    records = await resolveTxt(`_omi-studio-verification.${entry.hostname}`);
  } catch {
    return { status: 400, body: { error: { code: 'DOMAIN_CHALLENGE_NOT_FOUND' } } };
  }
  if (!records.some((chunks) => digest(chunks.join('')) === entry.domainChallengeHash)) {
    return { status: 400, body: { error: { code: 'DOMAIN_CHALLENGE_INVALID' } } };
  }
  // Atomic claim BEFORE the external side effect; a crash/unknown audit outcome is
  // quarantined for operator reconciliation, never blindly resubmitted to GitHub.
  if (!await repository.claim(id, digest(token))) return { status: 409, body: { error: { code: 'REGISTRATION_EXPIRED_OR_CONSUMED' } } };
  let githubIssueUrl: string;
  try {
    githubIssueUrl = await submitGithubRegistration(entry);
  } catch {
    return { status: 503, body: { error: { code: 'REGISTRY_AUDIT_RECONCILIATION_REQUIRED' } } };
  }
  const heartbeatToken = randomBytes(32).toString('base64url');
  if (!await repository.activate(id, digest(token), digest(heartbeatToken), githubIssueUrl)) return { status: 409, body: { error: { code: 'REGISTRATION_EXPIRED_OR_CONSUMED' } } };
  return { status: 200, body: { id, status: 'active', auditUrl: githubIssueUrl, heartbeatToken, heartbeatIntervalSeconds: 300 } };
}

export async function heartbeat(input: unknown = {}, id = '', authorization?: string): Promise<RegistryResult> {
  const token = bearerToken(authorization);
  if (!token) {
    return { status: 401, body: { error: { code: 'REGISTRY_TOKEN_REQUIRED', message: 'A valid registry bearer token is required.' } } };
  }

  const parsed = heartbeatSchema.safeParse(input);
  if (!parsed.success) {
    return { status: 400, body: { error: { code: 'INVALID_HEARTBEAT', message: 'Heartbeat details are invalid.' } } };
  }

  const entry = await repository.findById(id);
  if (!entry || entry.status !== 'ACTIVE' || !tokenMatches(token, entry.heartbeatTokenHash)) {
    return { status: 401, body: { error: { code: 'REGISTRY_TOKEN_INVALID', message: 'The registry token is invalid.' } } };
  }

  const changed = await repository.heartbeat(id, digest(token), parsed.data.softwareVersion, parsed.data.capabilities);
  return changed ? { status: 204 } : { status: 409, body: { error: { code: 'REGISTRY_CREDENTIAL_CHANGED' } } };
}

export async function rotate(_input: unknown = {}, id = '', authorization?: string): Promise<RegistryResult> {
  const token = bearerToken(authorization);
  if (!token) {
    return { status: 401, body: { error: { code: 'REGISTRY_TOKEN_REQUIRED', message: 'A valid registry bearer token is required.' } } };
  }
  const entry = await repository.findById(id);
  if (!entry || entry.status !== 'ACTIVE' || !tokenMatches(token, entry.heartbeatTokenHash)) {
    return { status: 401, body: { error: { code: 'REGISTRY_TOKEN_INVALID', message: 'The registry token is invalid.' } } };
  }
  const heartbeatToken = randomBytes(32).toString('base64url');
  const changed = await repository.rotate(id, digest(token), digest(heartbeatToken));
  return changed ? { status: 200, body: { heartbeatToken } } : { status: 409, body: { error: { code: 'REGISTRY_CREDENTIAL_CHANGED' } } };
}

export async function revoke(_input: unknown = {}, id = '', authorization?: string): Promise<RegistryResult> {
  const token = bearerToken(authorization);
  if (!token) {
    return { status: 401, body: { error: { code: 'REGISTRY_TOKEN_REQUIRED', message: 'A valid registry bearer token is required.' } } };
  }
  const entry = await repository.findById(id);
  if (!entry || entry.status !== 'ACTIVE' || !tokenMatches(token, entry.heartbeatTokenHash)) {
    return { status: 401, body: { error: { code: 'REGISTRY_TOKEN_INVALID', message: 'The registry token is invalid.' } } };
  }
  const changed = await repository.revoke(id, digest(token), digest(randomBytes(32).toString('base64url')));
  return changed ? { status: 204 } : { status: 409, body: { error: { code: 'REGISTRY_CREDENTIAL_CHANGED' } } };
}

export async function list(): Promise<RegistryResult> {
  const entries = await repository.list();
  const onlineBefore = Date.now() - 15 * 60 * 1000;
  return { status: 200, body: {
    servers: entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      origin: entry.origin,
      softwareVersion: entry.softwareVersion,
      capabilities: entry.capabilities,
      status: entry.lastHeartbeatAt && entry.lastHeartbeatAt.getTime() >= onlineBefore ? 'online' : 'offline',
      lastSeenAt: entry.lastHeartbeatAt?.toISOString() ?? null,
    })),
  } };
}
