import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { resolveTxt } from 'node:dns/promises';
import { isIP } from 'node:net';

import { identityPrisma } from '../lib/identityPrisma.js';

const DOMAIN_CLAIM_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const DOMAIN_RECHECK_MS = 24 * 60 * 60 * 1000;
const TXT_PREFIX = 'omi-publication-verification=';

export type PublicationVenueEditorRole = 'EDITOR' | 'EDITOR_IN_CHIEF';

export interface VerifiedPublicationVenueAuthority {
  type: 'verified-publication-venue';
  venueId: string;
  venueName: string;
  venueType: 'JOURNAL' | 'BOOK_PUBLISHER';
  domain: string;
  verificationMethod: 'DNS_TXT';
  verificationId: string;
  verifiedAt: string;
  editorRole: PublicationVenueEditorRole;
}

export interface PublicationVenueDomainClaimInput {
  type: 'JOURNAL' | 'BOOK_PUBLISHER';
  name: string;
  domain: string;
  website?: string | undefined;
  issn?: string | undefined;
  isbnPrefix?: string | undefined;
}

export async function createPublicationVenueDomainClaim(
  userId: string,
  input: PublicationVenueDomainClaimInput,
) {
  const name = normalizeDisplayName(input.name);
  const normalizedName = normalizeVenueName(name);
  if (!name || !normalizedName) throw new Error('A publication venue name is required.');
  const domain = normalizePublicationVenueDomain(input.domain);
  const website = cleanOptional(input.website);
  if (website) assertWebsiteMatchesDomain(website, domain);
  const issn = cleanOptional(input.issn)?.toUpperCase();
  const isbnPrefix = cleanOptional(input.isbnPrefix);

  const existing = await identityPrisma.publicationVenue.findUnique({
    where: { type_normalizedName: { type: input.type, normalizedName } },
    include: { domainVerifications: true },
  });
  if (existing) {
    const verifiedClaim = existing.domainVerifications.find(
      (claim) => claim.status === 'VERIFIED',
    );
    if (verifiedClaim) {
      throw conflict(
        verifiedClaim.domain === domain
          ? 'This publication venue domain is already verified.'
          : 'This publication venue already has a different verified domain.',
      );
    }
    if (existing.integrationStatus === 'VERIFIED') {
      if (!existing.website) {
        throw conflict(
          'An integrated publication venue without a registered website cannot be claimed through DNS.',
        );
      }
      assertWebsiteMatchesDomain(existing.website, domain);
    } else if (existing.createdByUserId !== userId) {
      if (!existing.website) {
        throw conflict(
          'An existing publication venue without a registered website cannot be claimed by another account.',
        );
      }
      assertWebsiteMatchesDomain(existing.website, domain);
    }
  }

  const venue = existing ?? await identityPrisma.publicationVenue.create({
    data: {
      type: input.type,
      name,
      normalizedName,
      createdByUserId: userId,
      ...(website ? { website } : {}),
      ...(issn ? { issn } : {}),
      ...(isbnPrefix ? { isbnPrefix } : {}),
    },
  });

  const token = randomBytes(32).toString('base64url');
  const txtValue = TXT_PREFIX + token;
  const expiresAt = new Date(Date.now() + DOMAIN_CLAIM_TTL_MS);
  const claim = await identityPrisma.publicationVenueDomainVerification.upsert({
    where: {
      venueId_domain_requestedByUserId: {
        venueId: venue.id,
        domain,
        requestedByUserId: userId,
      },
    },
    update: {
      txtRecordName: txtRecordName(domain),
      tokenHash: sha256(txtValue),
      status: 'PENDING',
      requestedByUserId: userId,
      expiresAt,
      verifiedAt: null,
      lastCheckedAt: null,
    },
    create: {
      venueId: venue.id,
      domain,
      txtRecordName: txtRecordName(domain),
      tokenHash: sha256(txtValue),
      status: 'PENDING',
      requestedByUserId: userId,
      expiresAt,
    },
  });
  return {
    venue,
    claim,
    challenge: {
      claimId: claim.id,
      venueId: venue.id,
      domain,
      txtName: claim.txtRecordName,
      txtValue,
      expiresAt: expiresAt.toISOString(),
    },
  };
}

export async function verifyPublicationVenueDomainClaim(userId: string, claimId: string) {
  const claim = await identityPrisma.publicationVenueDomainVerification.findUnique({
    where: { id: claimId },
    include: { venue: true },
  });
  if (!claim) throw notFound('The publication-venue domain claim was not found.');
  if (claim.requestedByUserId !== userId) {
    throw forbidden(
      'Only the authenticated account that requested this DNS challenge may consume it.',
    );
  }
  const competingVerifiedClaim =
    await identityPrisma.publicationVenueDomainVerification.findFirst({
      where: {
        venueId: claim.venueId,
        status: 'VERIFIED',
        id: { not: claim.id },
      },
      select: { id: true, domain: true },
    });
  if (competingVerifiedClaim) {
    throw conflict(
      'This publication venue already has a verified DNS authority. A separate authority-change workflow is required.',
    );
  }
  if (claim.status !== 'PENDING') {
    throw conflict(
      'This DNS verification challenge has already been consumed or revoked.',
    );
  }
  if (claim.expiresAt.getTime() <= Date.now()) {
    throw conflict('The DNS verification challenge expired. Request a new challenge.');
  }
  if (!(await dnsClaimMatches(claim.txtRecordName, claim.tokenHash))) {
    throw conflict(
      'The required public DNS TXT challenge was not found. DNS propagation may still be in progress.',
    );
  }
  const now = new Date();
  try {
    return await identityPrisma.$transaction(async (transaction) => {
      const verified = await transaction.publicationVenueDomainVerification.update({
        where: { id: claim.id },
        data: { status: 'VERIFIED', verifiedAt: claim.verifiedAt ?? now, lastCheckedAt: now },
        include: { venue: true },
      });
      await transaction.publicationVenueMembership.upsert({
        where: {
          venueId_userId_role: {
            venueId: claim.venueId,
            userId: claim.requestedByUserId,
            role: 'DOMAIN_ADMIN',
          },
        },
        update: { active: true, grantedByUserId: userId },
        create: {
          venueId: claim.venueId,
          userId: claim.requestedByUserId,
          role: 'DOMAIN_ADMIN',
          active: true,
          grantedByUserId: userId,
        },
      });
      return verified;
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw conflict(
        'Another DNS challenge established publication-venue authority first. Reload the venue authority before retrying.',
      );
    }
    throw error;
  }
}

export async function getPublicationVenueAuthorityOverview(userId: string, venueId: string) {
  const venue = await identityPrisma.publicationVenue.findUnique({
    where: { id: venueId },
    include: {
      domainVerifications: { where: { status: 'VERIFIED' }, orderBy: { verifiedAt: 'desc' } },
      memberships: {
        where: { active: true },
        include: { user: { select: { id: true, email: true, fullName: true } } },
        orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
      },
    },
  });
  if (!venue) throw notFound('The publication venue was not found.');
  const currentMemberships = venue.memberships.filter(
    (membership) => membership.userId === userId,
  );
  const isDomainAdmin = currentMemberships.some(
    (membership) => membership.role === 'DOMAIN_ADMIN',
  );
  return {
    venue,
    currentMemberships,
    members: isDomainAdmin ? venue.memberships : [],
    isDomainAdmin,
  };
}

export async function grantPublicationVenueEditor(
  adminUserId: string,
  venueId: string,
  email: string,
  role: PublicationVenueEditorRole,
) {
  await requireDomainAdmin(adminUserId, venueId);
  const user = await identityPrisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
  if (!user) throw notFound('The editor must already have a Studio account with this e-mail address.');
  return identityPrisma.publicationVenueMembership.upsert({
    where: {
      venueId_userId_role: {
        venueId,
        userId: user.id,
        role,
      },
    },
    update: { active: true, grantedByUserId: adminUserId },
    create: { venueId, userId: user.id, role, active: true, grantedByUserId: adminUserId },
    include: { user: { select: { id: true, email: true, fullName: true } } },
  });
}

export async function revokePublicationVenueEditor(
  adminUserId: string,
  venueId: string,
  membershipId: string,
): Promise<void> {
  await requireDomainAdmin(adminUserId, venueId);
  const membership = await identityPrisma.publicationVenueMembership.findFirst({
    where: { id: membershipId, venueId, role: { in: ['EDITOR', 'EDITOR_IN_CHIEF'] } },
  });
  if (!membership) throw notFound('The publication-venue editor membership was not found.');
  await identityPrisma.publicationVenueMembership.update({
    where: { id: membership.id },
    data: { active: false, grantedByUserId: adminUserId },
  });
}

export async function assertVerifiedPublicationVenueEditorAuthority(
  userId: string,
  venueId: string,
): Promise<VerifiedPublicationVenueAuthority> {
  const membership = await identityPrisma.publicationVenueMembership.findFirst({
    where: {
      venueId,
      userId,
      active: true,
      role: { in: ['EDITOR', 'EDITOR_IN_CHIEF'] },
    },
    include: {
      venue: {
        include: {
          domainVerifications: { where: { status: 'VERIFIED' }, orderBy: { verifiedAt: 'desc' } },
        },
      },
    },
    orderBy: { role: 'asc' },
  });
  if (!membership) {
    throw forbidden('An active editor or editor-in-chief role at the verified publication venue is required.');
  }
  const claim = membership.venue.domainVerifications[0];
  if (!claim || !claim.verifiedAt) throw conflict('The publication venue no longer has a verified DNS authority.');
  if (!claim.lastCheckedAt || claim.lastCheckedAt.getTime() < Date.now() - DOMAIN_RECHECK_MS) {
    if (!(await dnsClaimMatches(claim.txtRecordName, claim.tokenHash))) {
      throw conflict('The publication venue DNS authority could not be revalidated. Restore the TXT record before recording a new editorial decision.');
    }
    await identityPrisma.publicationVenueDomainVerification.update({
      where: { id: claim.id },
      data: { lastCheckedAt: new Date() },
    });
  }
  return {
    type: 'verified-publication-venue',
    venueId: membership.venue.id,
    venueName: membership.venue.name,
    venueType: membership.venue.type,
    domain: claim.domain,
    verificationMethod: 'DNS_TXT',
    verificationId: claim.id,
    verifiedAt: claim.verifiedAt.toISOString(),
    editorRole: membership.role,
  };
}

async function requireDomainAdmin(userId: string, venueId: string): Promise<void> {
  const [membership, verifiedClaim] = await Promise.all([
    identityPrisma.publicationVenueMembership.findFirst({
      where: { venueId, userId, role: 'DOMAIN_ADMIN', active: true },
    }),
    identityPrisma.publicationVenueDomainVerification.findFirst({ where: { venueId, status: 'VERIFIED' }, select: { id: true } }),
  ]);
  if (!verifiedClaim || !membership || !membership.active || membership.role !== 'DOMAIN_ADMIN') {
    throw forbidden('Domain-administrator authority is required for this publication venue.');
  }
}

async function dnsClaimMatches(txtName: string, expectedHash: string): Promise<boolean> {
  let records: string[][];
  try { records = await resolveTxt(txtName); } catch { return false; }
  return records.some((chunks) => safeHashEqual(sha256(chunks.join('')), expectedHash));
}

export function normalizePublicationVenueDomain(value: string): string {
  const raw = value.trim().replace(/\.$/u, '');
  if (!raw || raw.length > 253) throw new Error('A valid publication-venue domain is required.');
  let url: URL;
  try { url = new URL('https://' + raw); } catch { throw new Error('A valid publication-venue domain is required.'); }
  if (url.username || url.password || url.port || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('Enter only the publication venue domain, without a path or credentials.');
  }
  const domain = url.hostname.toLowerCase().replace(/\.$/u, '');
  if (
    domain === 'localhost' ||
    isIP(domain) !== 0 ||
    !domain.includes('.') ||
    domain.split('.').some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/iu.test(label))
  ) {
    throw new Error('A public DNS domain is required for publication-venue verification.');
  }
  return domain;
}

function assertWebsiteMatchesDomain(website: string, domain: string): void {
  let hostname: string;
  try { hostname = new URL(website).hostname.toLowerCase().replace(/\.$/u, ''); }
  catch { throw new Error('The publication venue website URL is invalid.'); }
  if (hostname !== domain && !hostname.endsWith('.' + domain)) {
    throw new Error('The publication venue website must use the domain being verified.');
  }
}
function txtRecordName(domain: string): string { return '_omi-publication.' + domain; }
function normalizeDisplayName(value: string): string { return value.normalize('NFKC').trim().replace(/\s+/gu, ' '); }
function normalizeVenueName(value: string): string { return normalizeDisplayName(value).toLocaleLowerCase('en-US'); }
function cleanOptional(value: string | undefined): string | undefined { const normalized = value?.trim(); return normalized || undefined; }
function sha256(value: string): string { return createHash('sha256').update(value, 'utf8').digest('hex'); }
function safeHashEqual(left: string, right: string): boolean {
  if (!/^[a-f0-9]{64}$/iu.test(left) || !/^[a-f0-9]{64}$/iu.test(right)) return false;
  return timingSafeEqual(Buffer.from(left, 'hex'), Buffer.from(right, 'hex'));
}
function isUniqueConstraintError(error: unknown): boolean {
  return Boolean(
    error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002',
  );
}
function forbidden(message: string): Error { const error = new Error(message); error.name = 'ForbiddenError'; return error; }
function conflict(message: string): Error { const error = new Error(message); error.name = 'ConflictError'; return error; }
function notFound(message: string): Error { const error = new Error(message); error.name = 'NotFoundError'; return error; }
