import { validatePublisherProfile } from '../model/publisherProfileImport';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import {
  canUnlockPublisherProfile,
  isPublisherProfileReadOnly,
  type ProtectablePublicationProfile,
} from '../model/publisherProfileProtection';

export const PUBLISHER_PROFILE_STORAGE_EVENT = 'omi:publisher-profiles-changed';
const STORAGE_KEY = 'omi.publisherProfiles.v1';

export function loadPublisherProfiles(): ProtectablePublicationProfile[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProfile) as ProtectablePublicationProfile[];
  } catch {
    return [];
  }
}

export function savePublisherProfile(profile: OmiPublicationProfile): ProtectablePublicationProfile[] {
  validatePublisherProfile(profile);
  const existing = loadPublisherProfiles();
  const sameVersion = existing.find(
    (item) => item.id === profile.id && item.version === profile.version,
  );

  if (sameVersion && isPublisherProfileReadOnly(sameVersion)) {
    throw new Error('This publisher profile version is read-only. Create a new version to make changes.');
  }

  const next = [
    profile as ProtectablePublicationProfile,
    ...existing.filter(
      (item) => !(item.id === profile.id && item.version === profile.version),
    ),
  ];
  persist(next);
  return next;
}

export function saveProtectedPublisherProfile(
  profile: ProtectablePublicationProfile,
): ProtectablePublicationProfile[] {
  if (!isPublisherProfileReadOnly(profile)) {
    throw new Error('Protected profile storage requires a read-only profile.');
  }

  const existing = loadPublisherProfiles();
  const current = existing.find(
    (item) => item.id === profile.id && item.version === profile.version,
  );
  if (current && isPublisherProfileReadOnly(current)) {
    throw new Error('This publisher profile version is already read-only.');
  }

  const next = [
    profile,
    ...existing.filter(
      (item) => !(item.id === profile.id && item.version === profile.version),
    ),
  ];
  persist(next);
  return next;
}

export function saveUnlockedPublisherProfile(
  profile: ProtectablePublicationProfile,
  actorUserId: string,
): ProtectablePublicationProfile[] {
  const existing = loadPublisherProfiles();
  const current = existing.find(
    (item) => item.id === profile.id && item.version === profile.version,
  );
  if (!current || !isPublisherProfileReadOnly(current)) {
    throw new Error('The stored publisher profile is not protected.');
  }
  if (!canUnlockPublisherProfile(current, actorUserId)) {
    throw new Error('Only the account that protected this profile can remove its protection.');
  }
  if (isPublisherProfileReadOnly(profile)) {
    throw new Error('The replacement profile must be editable.');
  }

  const next = [
    profile,
    ...existing.filter(
      (item) => !(item.id === profile.id && item.version === profile.version),
    ),
  ];
  persist(next);
  return next;
}

export function deletePublisherProfile(
  id: string,
  version?: string,
): ProtectablePublicationProfile[] {
  const next = loadPublisherProfiles().filter((profile) => (
    version
      ? !(profile.id === id && profile.version === version)
      : profile.id !== id
  ));
  persist(next);
  return next;
}

function persist(profiles: readonly ProtectablePublicationProfile[]): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
  window.dispatchEvent(new Event(PUBLISHER_PROFILE_STORAGE_EVENT));
}

function isProfile(value: unknown): value is OmiPublicationProfile {
  try { validatePublisherProfile(value); return true; } catch { return false; }
}
