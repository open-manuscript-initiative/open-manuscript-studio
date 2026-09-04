import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import {
  ExternalPlatform,
} from '../../generated/prisma/client.js';

import {
  prisma,
} from '../../lib/prisma.js';
import { getActiveInstallationWithSecret } from '../externalInstallations.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';

export interface LaunchClaims {
  protocol: string;
  profile?: string;
  installationId: string;
  context?: {
    externalId?: string;
    type?: string;
    path?: string;
  };
  submission?: {
    externalId?: string;
  };
  actor?: {
    externalId?: string;
  };
  actorMode?: 'editor' | 'author' | 'review';
  reviewAssignment?: {
    externalId?: string;
    round?: number;
  };
  scope?: string[];
  iat: number;
  exp: number;
  nonce: string;
  externalBaseUrl?: string;
  apiBaseUrl?: string;
}

const REVIEWER_REQUIRED_SCOPES = [
  'review.metadata.read',
  'review.files.read',
  'review.manuscript.read',
  'review.revision.write',
  'review.response.write',
  'review.form.read',
  'review.form.write',
] as const;

const REVIEWER_FORBIDDEN_SCOPES = [
  'contributors.read',
  'contributors.write',
  'metadata.write',
  'files.write',
  'manuscript.write',
  'revision.read',
  'revision.write',
  'author.manuscript.write',
  'author.revision.write',
  'review.assignment.read',
  'review.assignment.write',
  'review.identity.read',
  'review.response.read',
] as const;

function validateClaimsShape(
  value: unknown,
): value is LaunchClaims {
  if (
    value === null ||
    typeof value !== 'object'
  ) {
    return false;
  }

  const claims = value as Record<string, unknown>;
  return (
    claims.protocol === 'omi-integration/1' &&
    typeof claims.installationId === 'string' &&
    typeof claims.iat === 'number' &&
    typeof claims.exp === 'number' &&
    typeof claims.nonce === 'string' &&
    (claims.profile === undefined || typeof claims.profile === 'string') &&
    (claims.externalBaseUrl === undefined || typeof claims.externalBaseUrl === 'string') &&
    (claims.apiBaseUrl === undefined || typeof claims.apiBaseUrl === 'string') &&
    (
      claims.actorMode === undefined ||
      claims.actorMode === 'editor' ||
      claims.actorMode === 'author' ||
      claims.actorMode === 'review'
    ) &&
    (
      claims.scope === undefined ||
      (Array.isArray(claims.scope) && claims.scope.every((item) => typeof item === 'string'))
    )
  );
}

export async function verifyOjsLaunch(payload: string, signature: string) {
  let claimsValue: unknown;
  try {
    claimsValue = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Invalid launch payload.');
  }
  if (!validateClaimsShape(claimsValue)) throw new Error('Invalid launch claims.');
  const claims = claimsValue;
  if (claims.profile && claims.profile !== 'omi-integration/1/ojs') {
    throw new Error('Unsupported integration profile.');
  }

  const installation = await getActiveInstallationWithSecret(claims.installationId);
  if (!installation || installation.platform !== ExternalPlatform.OJS) {
    throw new Error('Unknown or disabled OJS installation.');
  }

  const expected = createHmac('sha256', installation.sharedSecret).update(payload).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signature, 'base64url');
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
  if (claims.nonce.length < 1 || claims.nonce.length > 256) throw new Error('Invalid launch nonce.');
  if (claims.actorMode === 'review') validateReviewerBoundary(claims);

  if (claims.apiBaseUrl) {
    const trustedApiBaseUrl = await assertTrustedIntegrationUrl(claims.apiBaseUrl, installation.baseUrl);
    claims.apiBaseUrl = trustedApiBaseUrl.toString().replace(/\/$/, '');
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
      throw new Error('Launch assertion has already been used.', { cause: error });
    }
    const message = error instanceof Error ? `: ${error.message}` : '.';
    throw new Error(`Unable to persist the launch nonce${message}`, { cause: error });
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

function validateReviewerBoundary(claims: LaunchClaims): void {
  if (!claims.submission?.externalId?.trim()) throw new Error('Reviewer launch does not identify a submission.');
  if (!claims.reviewAssignment?.externalId?.trim()) throw new Error('Reviewer launch does not identify a review assignment.');
  if (!claims.actor?.externalId?.trim()) throw new Error('Reviewer launch does not identify the reviewer.');

  const scopes = new Set(claims.scope ?? []);
  for (const required of REVIEWER_REQUIRED_SCOPES) {
    if (!scopes.has(required)) throw new Error(`Reviewer launch is missing required scope: ${required}.`);
  }
  for (const forbidden of REVIEWER_FORBIDDEN_SCOPES) {
    if (scopes.has(forbidden)) throw new Error(`Reviewer launch contains forbidden scope: ${forbidden}.`);
  }
}
