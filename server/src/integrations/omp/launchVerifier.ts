import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import {
  ExternalPlatform,
} from '../../generated/prisma/client.js';

import { prisma } from '../../lib/prisma.js';
import { getActiveInstallationWithSecret } from '../externalInstallations.js';

export interface OmpLaunchClaims {
  protocol: string;
  profile?: string;
  installationId: string;
  context?: {
    externalId?: string;
    type?: string;
    path?: string;
    name?: string;
  };
  submission?: {
    externalId?: string;
    type?: string;
  };
  component?: {
    externalId?: string;
    type?: string;
  };
  actor?: {
    externalId?: string;
  };
  actorMode?: 'editor' | 'author' | 'review';
  scope?: string[];
  iat: number;
  exp: number;
  nonce: string;
  externalBaseUrl?: string;
  apiBaseUrl?: string;
}

function validateClaimsShape(value: unknown): value is OmpLaunchClaims {
  if (value === null || typeof value !== 'object') return false;
  const claims = value as Record<string, unknown>;
  return (
    claims.protocol === 'omi-integration/1' &&
    typeof claims.installationId === 'string' &&
    typeof claims.iat === 'number' &&
    typeof claims.exp === 'number' &&
    typeof claims.nonce === 'string'
  );
}

export async function verifyOmpLaunch(payload: string, signature: string) {
  let claimsValue: unknown;

  try {
    claimsValue = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8'),
    );
  } catch {
    throw new Error('Invalid OMP launch payload.');
  }

  if (!validateClaimsShape(claimsValue)) {
    throw new Error('Invalid OMP launch claims.');
  }

  const claims = claimsValue;
  if (claims.profile && claims.profile !== 'omi-integration/1/omp') {
    throw new Error('Unsupported OMP integration profile.');
  }

  const installation = await getActiveInstallationWithSecret(
    claims.installationId,
  );

  if (!installation || installation.platform !== ExternalPlatform.OMP) {
    throw new Error('Unknown or disabled OMP installation.');
  }

  const expected = createHmac('sha256', installation.sharedSecret)
    .update(payload)
    .digest();

  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64url');
  } catch {
    throw new Error('Invalid OMP launch signature.');
  }

  if (
    expected.length !== received.length ||
    !timingSafeEqual(expected, received)
  ) {
    throw new Error('Invalid OMP launch signature.');
  }

  const now = Math.floor(Date.now() / 1000);
  if (
    claims.iat > now + 60 ||
    claims.exp < now ||
    claims.exp - claims.iat > 3600
  ) {
    throw new Error('Expired or invalid OMP launch assertion.');
  }

  if (claims.nonce.length < 1 || claims.nonce.length > 256) {
    throw new Error('Invalid OMP launch nonce.');
  }

  try {
    await prisma.externalLaunchNonce.create({
      data: {
        installationId: claims.installationId,
        nonce: claims.nonce,
        expiresAt: new Date(claims.exp * 1000),
      },
    });
  } catch (error: unknown) {
    const prismaError = error as { code?: string };
    if (prismaError.code === 'P2002') {
      throw new Error('OMP launch assertion has already been used.');
    }
    const message = error instanceof Error ? `: ${error.message}` : '.';
    throw new Error(`Unable to persist the OMP launch nonce${message}`);
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
