import type { OmiPublicationProfile } from '../model/publicationProfile';

const STORAGE_KEY = 'omi.publisherProfiles.v1';

export function loadPublisherProfiles(): OmiPublicationProfile[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isProfile);
  } catch {
    return [];
  }
}

export function savePublisherProfile(profile: OmiPublicationProfile): OmiPublicationProfile[] {
  const existing = loadPublisherProfiles();
  const next = [profile, ...existing.filter((item) => item.id !== profile.id)];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function deletePublisherProfile(id: string): OmiPublicationProfile[] {
  const next = loadPublisherProfiles().filter((profile) => profile.id !== id);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

function isProfile(value: unknown): value is OmiPublicationProfile {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<OmiPublicationProfile>;
  return candidate.model === 'omi-publication-profile-alpha-0.1'
    && typeof candidate.id === 'string'
    && typeof candidate.version === 'string'
    && typeof candidate.name === 'string'
    && Boolean(candidate.rules);
}
