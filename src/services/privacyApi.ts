import { isTauri } from '@tauri-apps/api/core';
import { getStudioApiBaseUrl } from './studioServer';

export interface PrivacyNotice {
  version: string; language: string;
  controller: { name: string; postalAddress: string; email: string; dpoEmail?: string };
  noticeUrl: string; authority: { name: string; url: string };
  processing: Array<{ purpose: string; categories: string; legalBasis: string; retention: string; recipients: string; internationalTransfers: string }>;
  rights: string; dataSources: string; requiredData: string; automatedDecisions: string;
  cookies: string; backups: string; deletion: string;
}
export type PublicPrivacyNotice = { configured: false } | { configured: true; notice: PrivacyNotice };

export async function fetchPrivacyNotice(signal?: AbortSignal): Promise<PublicPrivacyNotice> {
  const response = await fetch(`${getStudioApiBaseUrl()}/api/privacy`, {
    credentials: 'omit', cache: 'no-store', signal, headers: { Accept: 'application/json' },
  });
  if (!response.ok) throw new Error('Privacy notice is unavailable.');
  return response.json() as Promise<PublicPrivacyNotice>;
}

export async function fetchAccountData(): Promise<Blob> {
  const headers = new Headers({ Accept: 'application/json' });
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem('omi_native_session_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${getStudioApiBaseUrl()}/api/account/data`, {
    credentials: 'include', cache: 'no-store', headers,
  });
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
