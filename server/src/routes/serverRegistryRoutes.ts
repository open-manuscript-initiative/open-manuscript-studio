import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';

import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { createServerRegistryGithubToken } from '../serverRegistry/githubAppToken.js';

export const serverRegistryRouter = Router();

const registrationRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false });
const verificationRateLimit = rateLimit({ windowMs: 60 * 60 * 1000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });

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

async function submitGithubRegistration(entry: {
  id: string;
  name: string;
  origin: string;
  softwareVersion: string | null;
  capabilities: unknown;
}): Promise<string> {
  const installationToken = await createServerRegistryGithubToken();

  const body = [
    'A Studio server completed HTTPS domain verification and requested directory registration.',
    '',
    `- Registry ID: ${entry.id}`,
    `- Name: ${entry.name}`,
    `- Origin: ${entry.origin}`,
    `- Studio version: ${entry.softwareVersion ?? 'not supplied'}`,
    `- Capabilities: ${JSON.stringify(entry.capabilities ?? [])}`,
    '',
    'This issue is an audit notification. Live status is stored in the registry database and is not updated here.',
  ].join('\n');

  const response = await fetch(
    `https://api.github.com/repos/${env.OMI_SERVER_REGISTRY_GITHUB_REPOSITORY}/issues`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${installationToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: `Studio server directory registration: ${entry.name}`,
        body,
      }),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!response.ok) {
    throw new Error(`GitHub registration audit failed with HTTP ${response.status}.`);
  }
  const result = await response.json() as { html_url?: string };
  if (!result.html_url) throw new Error('GitHub did not return the registration issue URL.');
  return result.html_url;
}

serverRegistryRouter.post('/registrations', registrationRateLimit, async (request, response) => {
  const parsed = registrationSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'INVALID_REGISTRATION', message: 'Registration details are invalid.' } });
    return;
  }

  let normalized: { origin: string; hostname: string };
  try {
    normalized = normalizePublicOrigin(parsed.data.origin);
  } catch (error) {
    response.status(400).json({ error: { code: 'INVALID_SERVER_ORIGIN', message: error instanceof Error ? error.message : 'Invalid server origin.' } });
    return;
  }

  const existing = await prisma.studioServerDirectoryEntry.findUnique({ where: { origin: normalized.origin } });
  if (existing && existing.status !== 'REVOKED') {
    response.status(409).json({ error: { code: 'SERVER_ALREADY_REGISTERED', message: 'This server is already registered or awaiting verification.' } });
    return;
  }

  const id = existing?.id ?? randomBytes(16).toString('hex');
  const challenge = randomBytes(24).toString('base64url');
  const heartbeatToken = randomBytes(32).toString('base64url');
  const data = {
    name: parsed.data.name,
    origin: normalized.origin,
    hostname: normalized.hostname,
    status: 'PENDING' as const,
    domainChallengeHash: digest(challenge),
    heartbeatTokenHash: digest(heartbeatToken),
    softwareVersion: parsed.data.softwareVersion,
    capabilities: parsed.data.capabilities,
    verifiedAt: null,
    lastHeartbeatAt: null,
    githubIssueUrl: null,
  };
  const record = existing
    ? await prisma.studioServerDirectoryEntry.update({ where: { id }, data })
    : await prisma.studioServerDirectoryEntry.create({ data: { id, ...data } });

  response.status(201).json({
    id: record.id,
    status: 'pending_domain_verification',
    verification: {
      type: 'dns-txt',
      name: `_omi-studio-verification.${normalized.hostname}`,
      value: challenge,
    },
    heartbeatToken,
    heartbeatIntervalSeconds: 300,
    instructions: 'Publish the DNS TXT record, then call POST /api/server-registry/registrations/{id}/verify. Store the heartbeat token only on the server.',
  });
});

serverRegistryRouter.post('/registrations/:id/verify', verificationRateLimit, async (request, response) => {
  const entry = await prisma.studioServerDirectoryEntry.findUnique({ where: { id: request.params.id } });
  if (!entry || entry.status !== 'PENDING') {
    response.status(404).json({ error: { code: 'REGISTRATION_NOT_FOUND', message: 'Pending registration not found.' } });
    return;
  }

  let records: string[] = [];
  try {
    const txt = await resolveTxt(`_omi-studio-verification.${entry.hostname}`);
    records = txt.flat();
  } catch {
    response.status(400).json({ error: { code: 'DOMAIN_CHALLENGE_NOT_FOUND', message: 'The DNS verification record could not be found.' } });
    return;
  }

  if (!records.some((record) => digest(record) === entry.domainChallengeHash)) {
    response.status(400).json({ error: { code: 'DOMAIN_CHALLENGE_INVALID', message: 'The DNS verification record does not match.' } });
    return;
  }

  let githubIssueUrl: string;
  try {
    githubIssueUrl = await submitGithubRegistration(entry);
  } catch (error) {
    console.error('Studio server registration audit failed:', error);
    response.status(503).json({ error: { code: 'REGISTRY_AUDIT_UNAVAILABLE', message: 'The registration audit service is temporarily unavailable. Try again later.' } });
    return;
  }

  const verified = await prisma.studioServerDirectoryEntry.update({
    where: { id: entry.id },
    data: { status: 'ACTIVE', verifiedAt: new Date(), githubIssueUrl },
  });
  response.status(200).json({ id: verified.id, status: 'active', auditUrl: githubIssueUrl });
});

serverRegistryRouter.post('/instances/:id/heartbeat', async (request, response) => {
  const token = bearerToken(request.header('authorization'));
  if (!token) {
    response.status(401).json({ error: { code: 'REGISTRY_TOKEN_REQUIRED', message: 'A valid registry bearer token is required.' } });
    return;
  }

  const parsed = heartbeatSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'INVALID_HEARTBEAT', message: 'Heartbeat details are invalid.' } });
    return;
  }

  const entry = await prisma.studioServerDirectoryEntry.findUnique({ where: { id: request.params.id } });
  if (!entry || entry.status !== 'ACTIVE' || !tokenMatches(token, entry.heartbeatTokenHash)) {
    response.status(401).json({ error: { code: 'REGISTRY_TOKEN_INVALID', message: 'The registry token is invalid.' } });
    return;
  }

  await prisma.studioServerDirectoryEntry.update({
    where: { id: entry.id },
    data: {
      lastHeartbeatAt: new Date(),
      softwareVersion: parsed.data.softwareVersion ?? entry.softwareVersion,
      ...(parsed.data.capabilities ? { capabilities: parsed.data.capabilities } : {}),
    },
  });
  response.status(204).end();
});

serverRegistryRouter.get('/servers', async (_request, response) => {
  const entries = await prisma.studioServerDirectoryEntry.findMany({
    where: { status: 'ACTIVE' },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      origin: true,
      softwareVersion: true,
      capabilities: true,
      lastHeartbeatAt: true,
    },
  });
  const onlineBefore = Date.now() - 15 * 60 * 1000;
  response.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
  response.status(200).json({
    servers: entries.map((entry) => ({
      id: entry.id,
      name: entry.name,
      origin: entry.origin,
      softwareVersion: entry.softwareVersion,
      capabilities: entry.capabilities,
      status: entry.lastHeartbeatAt && entry.lastHeartbeatAt.getTime() >= onlineBefore ? 'online' : 'offline',
      lastSeenAt: entry.lastHeartbeatAt?.toISOString() ?? null,
    })),
  });
});
