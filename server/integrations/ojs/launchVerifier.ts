import {createHmac, timingSafeEqual} from 'node:crypto';
import {ExternalPlatform} from '@prisma/client';
import {prisma} from '../../db';
import {getActiveInstallationWithSecret} from '../externalInstallations';

interface LaunchClaims {
  protocol: string;
  profile?: string;
  installationId: string;
  context?: {externalId?: string; type?: string; path?: string};
  submission?: {externalId?: string};
  actor?: {externalId?: string};
  scope?: string[];
  iat: number;
  exp: number;
  nonce: string;
}

function decodeBase64Url(value: string): Buffer {
  return Buffer.from(value, 'base64url');
}

function validateClaimsShape(value: unknown): value is LaunchClaims {
  if (!value || typeof value !== 'object') return false;
  const claims = value as Record<string, unknown>;
  return (
    claims.protocol === 'omi-integration/1' &&
    typeof claims.installationId === 'string' &&
    typeof claims.iat === 'number' &&
    typeof claims.exp === 'number' &&
    typeof claims.nonce === 'string'
  );
}

export async function verifyOjsLaunch(payload: string, signature: string) {
  let parsed: unknown;
  try {
    parsed = JSON.parse(decodeBase64Url(payload).toString('utf8'));
  } catch {
    throw new Error('Invalid launch payload.');
  }

  if (!validateClaimsShape(parsed)) {
    throw new Error('Invalid launch claims.');
  }

  const claims = parsed;
  if (claims.profile && claims.profile !== 'omi-integration/1/ojs') {
    throw new Error('Unsupported integration profile.');
  }

  const installation = await getActiveInstallationWithSecret(claims.installationId);
  if (!installation || installation.platform !== ExternalPlatform.OJS) {
    throw new Error('Unknown or disabled OJS installation.');
  }

  const expected = createHmac('sha256', installation.sharedSecret)
    .update(payload)
    .digest();

  let received: Buffer;
  try {
    received = decodeBase64Url(signature);
  } catch {
    throw new Error('Invalid launch signature.');
  }

  if (expected.length !== received.length || !timingSafeEqual(expected, received)) {
    throw new Error('Invalid launch signature.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (claims.iat > now + 60 || claims.exp < now || claims.exp - claims.iat > 3600) {
    throw new Error('Expired or invalid launch assertion.');
  }

  if (!claims.nonce || claims.nonce.length > 256) {
    throw new Error('Invalid launch nonce.');
  }

  try {
    await prisma.externalLaunchNonce.create({
      data: {
        installationId: claims.installationId,
        nonce: claims.nonce,
        expiresAt: new Date(claims.exp * 1000),
      },
    });
  } catch {
    throw new Error('Launch assertion has already been used.');
  }

  return {
    claims,
    installation: {
      id: installation.id,
      installationId: installation.installationId,
      displayName: installation.displayName,
      baseUrl: installation.baseUrl,
    },
  };
}
