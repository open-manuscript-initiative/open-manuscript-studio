import type { OmiPublicationProfile } from './publicationProfile';

export type PublisherProfileIdentityMethod =
  | 'authenticated-account'
  | 'verified-email'
  | 'ror-affiliation'
  | 'institutional-identity';

export interface PublisherProfileActor {
  userId: string;
  email: string;
  displayName: string;
  status: 'pending' | 'active' | 'suspended' | 'disabled' | 'deleted';
  emailVerified?: boolean;
  affiliation?: string;
  affiliationRorId?: string;
  identityProviders?: string[];
}

export interface PublisherProfileProtection {
  readOnly: true;
  lockedAt: string;
  lockedByUserId: string;
  lockedByEmail: string;
  lockedByName: string;
  identityMethod: PublisherProfileIdentityMethod;
  affiliation?: string;
  affiliationRorId?: string;
}

export type ProtectablePublicationProfile = OmiPublicationProfile & {
  protection?: PublisherProfileProtection;
};

export function isPublisherProfileReadOnly(
  profile: OmiPublicationProfile,
): profile is ProtectablePublicationProfile & { protection: PublisherProfileProtection } {
  const protection = (profile as ProtectablePublicationProfile).protection;
  return protection?.readOnly === true;
}

export function canProtectPublisherProfile(actor: PublisherProfileActor | undefined): boolean {
  return Boolean(
    actor
      && actor.status === 'active'
      && actor.userId.trim()
      && actor.email.trim()
      && actor.displayName.trim(),
  );
}

export function protectPublisherProfile(
  profile: OmiPublicationProfile,
  actor: PublisherProfileActor,
  now: string = new Date().toISOString(),
): ProtectablePublicationProfile {
  if (isPublisherProfileReadOnly(profile)) {
    return profile;
  }
  if (!canProtectPublisherProfile(actor)) {
    throw new Error('An active authenticated publisher account is required to protect this profile.');
  }

  return {
    ...profile,
    protection: {
      readOnly: true,
      lockedAt: now,
      lockedByUserId: actor.userId,
      lockedByEmail: actor.email,
      lockedByName: actor.displayName,
      identityMethod: strongestIdentityMethod(actor),
      affiliation: actor.affiliation?.trim() || undefined,
      affiliationRorId: actor.affiliationRorId?.trim() || undefined,
    },
  };
}

export function canUnlockPublisherProfile(
  profile: OmiPublicationProfile,
  actorUserId: string | undefined,
): boolean {
  if (!isPublisherProfileReadOnly(profile) || !actorUserId) return false;
  return profile.protection.lockedByUserId === actorUserId;
}

export function unlockPublisherProfile(
  profile: OmiPublicationProfile,
  actorUserId: string,
): ProtectablePublicationProfile {
  if (!isPublisherProfileReadOnly(profile)) {
    return profile;
  }
  if (!canUnlockPublisherProfile(profile, actorUserId)) {
    throw new Error('Only the authenticated account that protected this profile can remove its protection.');
  }

  const editable = { ...(profile as ProtectablePublicationProfile) };
  delete editable.protection;
  return editable;
}

export function createEditablePublisherProfileVersion(
  profile: OmiPublicationProfile,
  version: string = timestampVersion(),
): ProtectablePublicationProfile {
  const editable = JSON.parse(JSON.stringify(profile)) as ProtectablePublicationProfile;
  delete editable.protection;
  editable.version = version;
  return editable;
}

export function publisherProfileIdentityLabel(
  profile: OmiPublicationProfile,
): PublisherProfileIdentityMethod | undefined {
  return isPublisherProfileReadOnly(profile)
    ? profile.protection.identityMethod
    : undefined;
}

function strongestIdentityMethod(actor: PublisherProfileActor): PublisherProfileIdentityMethod {
  if (actor.identityProviders?.includes('institutional')) return 'institutional-identity';
  if (actor.affiliationRorId?.trim()) return 'ror-affiliation';
  if (actor.emailVerified) return 'verified-email';
  return 'authenticated-account';
}

function timestampVersion(): string {
  return new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
}
