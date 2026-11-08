import { studioApiFetch } from '../platform/studioApiTransport';
import { getStudioApiBaseUrl } from './studioServer';
import type { PublicPrivacyNotice } from '../api/privacyContract';
export type { PrivacyNotice, PublicPrivacyNotice } from '../api/privacyContract';

export async function fetchPrivacyNotice(signal?: AbortSignal): Promise<PublicPrivacyNotice> {
  const response = await fetch(`${getStudioApiBaseUrl()}/api/v1/privacy`, {
    credentials: 'omit', cache: 'no-store', signal, headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Privacy notice is unavailable.');
  return response.json() as Promise<PublicPrivacyNotice>;
}

export async function fetchAccountData(): Promise<Blob> {
  const response = await studioApiFetch('/api/v1/account/data');
  if (!response.ok) throw new Error('Account data copy is unavailable.');
  return response.blob();
}

/** Validate even when a selected third-party server returns an unexpected value. */
export function publicPrivacyLink(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : undefined;
  } catch { return undefined; }
}
export function privacyContactLink(email: string, subject: string): string | undefined {
  if (!/^[A-Za-z0-9.!$'*+/=_`{|}~-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,63}$/.test(email)) return undefined;
  return `mailto:${encodeURIComponent(email)}?subject=${encodeURIComponent(subject)}`;
}
