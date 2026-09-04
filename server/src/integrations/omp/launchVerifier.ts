import {
  createHmac,
  timingSafeEqual,
} from 'node:crypto';

import {
  ExternalPlatform,
} from '../../generated/prisma/client.js';

import { prisma } from '../../lib/prisma.js';
import { getActiveInstallationWithSecret } from '../externalInstallations.js';
import { assertTrustedIntegrationUrl } from '../security/trustedRemoteUrl.js';

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
    title?: string;
  };
  reviewAssignment?: {
    externalId?: string;
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
  'metadata.read',
  'metadata.write',
  'contributors.read',
  'contributors.write',
  'files.read',
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

function validateClaimsShape(value: unknown): value is OmpLaunchClaims {
  if (value === null || typeof value !== 'object') return false;
  const claims = value as Record<string, unknown>;
  const component = claims.component;
  const reviewAssignment = claims.reviewAssignment;
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
      component === undefined ||
      (
        component !== null &&
        typeof component === 'object' &&
        (!('externalId' in component) || typeof (component as Record<string, unknown>).externalId === 'string') &&
        (!('type' in component) || typeof (component as Record<string, unknown>).type === 'string') &&
        (!('title' in component) || typeof (component as Record<string, unknown>).title === 'string')
      )
    ) &&
    (
      reviewAssignment === undefined ||
      (
        reviewAssignment !== null &&
        typeof reviewAssignment === 'object' &&
        (
          !('externalId' in reviewAssignment) ||
          typeof (reviewAssignment as Record<string, unknown>).externalId === 'string'
        )
      )
    ) &&
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

  if (claims.actorMode === 'review') validateReviewerBoundary(claims);

  if (claims.apiBaseUrl) {
    const trustedApiBaseUrl = await assertTrustedIntegrationUrl(
      claims.apiBaseUrl,
      installation.baseUrl,
    );
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
      throw new Error('OMP launch assertion has already been used.', { cause: error });
    }
    const message = error instanceof Error ? `: ${error.message}` : '.';
    throw new Error(`Unable to persist the OMP launch nonce${message}`, { cause: error });
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

function validateReviewerBoundary(claims: OmpLaunchClaims): void {
  if (!claims.context?.externalId?.trim()) {
    throw new Error('OMP reviewer launch does not identify a press context.');
  }
  if (!claims.submission?.externalId?.trim()) {
    throw new Error('OMP reviewer launch does not identify a submission.');
  }
  if (!claims.component?.externalId?.trim()) {
    throw new Error('OMP reviewer launch does not identify the assigned study.');
  }
  if (!claims.reviewAssignment?.externalId?.trim()) {
    throw new Error('OMP reviewer launch does not identify a review assignment.');
  }
  if (!claims.actor?.externalId?.trim()) {
    throw new Error('OMP reviewer launch does not identify the reviewer.');
  }
  if (!claims.apiBaseUrl?.trim()) {
    throw new Error('OMP reviewer launch does not identify its assignment-scoped API.');
  }

  const scopes = new Set(claims.scope ?? []);
  for (const required of REVIEWER_REQUIRED_SCOPES) {
    if (!scopes.has(required)) {
      throw new Error(`OMP reviewer launch is missing required scope: ${required}.`);
    }
  }
  for (const forbidden of REVIEWER_FORBIDDEN_SCOPES) {
    if (scopes.has(forbidden)) {
      throw new Error(`OMP reviewer launch contains forbidden scope: ${forbidden}.`);
    }
  }
}
