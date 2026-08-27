import type { OmiPublicationProfile } from './publicationProfile';
import type { PublisherProfileActor } from './publisherProfileProtection';

export interface OmiPublisherIdentity {
  id: string;
  displayName: string;
  defaultEmail: string;
  website?: string;
  rorId?: string;
}

declare module './publicationProfile' {
  interface OmiPublicationProfile {
    /** Stable publisher identity shared by one or more publication profiles. */
    publisherIdentity?: OmiPublisherIdentity;
  }
}

export function normalizePublisherEmail(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

export function createPublisherIdentity(
  displayName: string,
  defaultEmail: string,
  existingId?: string,
): OmiPublisherIdentity {
  const name = displayName.trim();
  const email = normalizePublisherEmail(defaultEmail);
  if (!name) throw new Error('Publisher identity name is required.');
  if (!isPublisherEmail(email)) throw new Error('A valid default publisher email address is required.');
  return {
    id: existingId?.trim() || `publisher:${crypto.randomUUID()}`,
    displayName: name,
    defaultEmail: email,
  };
}

export function isPublisherEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizePublisherEmail(value));
}

/**
 * Ownership is based on the authenticated, verified account email rather than
 * on a device-local user id. This keeps publisher identity portable while
 * still requiring control of the configured mailbox.
 */
export function actorOwnsPublisherIdentity(
  profile: Pick<OmiPublicationProfile, 'publisherIdentity'>,
  actor: PublisherProfileActor | undefined,
): boolean {
  const ownerEmail = normalizePublisherEmail(profile.publisherIdentity?.defaultEmail);
  const actorEmail = normalizePublisherEmail(actor?.email);
  return Boolean(
    ownerEmail
      && actor
      && actor.status === 'active'
      && actor.emailVerified === true
      && actorEmail === ownerEmail,
  );
}
