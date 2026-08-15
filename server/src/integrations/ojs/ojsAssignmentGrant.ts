import { createHmac, timingSafeEqual } from 'node:crypto';

import { env } from '../../config/env.js';

export type OjsAssignmentActorMode = 'editor' | 'author';

export interface OjsAssignmentGrantClaims {
  installationId: string;
  contextId: string;
  manuscriptId: string;
  actorEmail: string;
  actorMode: OjsAssignmentActorMode;
  exp: number;
}

export function issueOjsAssignmentGrant(
  claims: Omit<OjsAssignmentGrantClaims, 'exp'>,
  ttlSeconds = 3600,
): string {
  const payload = Buffer.from(JSON.stringify({
    ...claims,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  }), 'utf8').toString('base64url');
  return `${payload}.${sign(payload)}`;
}

export function verifyOjsAssignmentGrant(token: string): OjsAssignmentGrantClaims {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) throw forbidden();

  const expected = Buffer.from(sign(payload));
  const received = Buffer.from(signature);
  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw forbidden();
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as unknown;
  } catch {
    throw forbidden();
  }
  if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) throw forbidden();
  const record = decoded as Record<string, unknown>;
  const actorMode = record.actorMode;
  if (actorMode !== 'editor' && actorMode !== 'author') throw forbidden();

  const claims: OjsAssignmentGrantClaims = {
    installationId: requiredText(record.installationId),
    contextId: requiredText(record.contextId),
    manuscriptId: requiredText(record.manuscriptId),
    actorEmail: requiredText(record.actorEmail).toLowerCase(),
    actorMode,
    exp: typeof record.exp === 'number' ? record.exp : 0,
  };
  if (claims.exp <= Math.floor(Date.now() / 1000)) throw forbidden();
  return claims;
}

function sign(payload: string): string {
  return createHmac('sha256', Buffer.from(env.INTEGRATION_MASTER_KEY, 'hex'))
    .update(payload)
    .digest('base64url');
}

function requiredText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw forbidden();
  return value.trim();
}

function forbidden(): Error {
  const error = new Error('The OJS assignment grant is invalid or expired.');
  error.name = 'ForbiddenError';
  return error;
}
