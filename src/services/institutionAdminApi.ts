import { isTauri } from '@tauri-apps/api/core';

import type { User } from '../model/user';

export interface InstitutionAdminContext {
  membershipId: string;
  institutionId: string;
  name: string;
  rorId: string | null;
  role: 'ADMIN' | 'OWNER';
}

interface NativeAdminLoginResponse {
  user: User;
  token?: string;
  expiresAt?: string;
  institutionAdmin: true;
}

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const ADMIN_LOGIN_PENDING_KEY = 'omi_institution_admin_login_pending';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export async function loginInstitutionAdminAccount(input: {
  email: string;
  password: string;
}): Promise<User> {
  const response = await fetch(`${apiBaseUrl()}/api/auth/institution-admin/login`, {
    method: 'POST',
    credentials: 'include',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(input),
  });
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as NativeAdminLoginResponse;
  if (isTauri() && payload.token) {
    globalThis.localStorage?.setItem(NATIVE_SESSION_KEY, payload.token);
  }
  clearInstitutionAdminLoginPending();
  return payload.user;
}

export async function getInstitutionAdminContext(): Promise<InstitutionAdminContext[]> {
  const response = await fetch(`${apiBaseUrl()}/api/auth/institutions/admin-context`, {
    method: 'GET',
    credentials: 'include',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as { institutions: InstitutionAdminContext[] };
  return payload.institutions;
}

export function markInstitutionAdminLoginPending(): void {
  globalThis.localStorage?.setItem(ADMIN_LOGIN_PENDING_KEY, '1');
}

export function consumeInstitutionAdminLoginPending(): boolean {
  const storage = globalThis.localStorage;
  if (!storage || storage.getItem(ADMIN_LOGIN_PENDING_KEY) !== '1') return false;
  storage.removeItem(ADMIN_LOGIN_PENDING_KEY);
  return true;
}

export function clearInstitutionAdminLoginPending(): void {
  globalThis.localStorage?.removeItem(ADMIN_LOGIN_PENDING_KEY);
}

function apiBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isTauri() && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '';
}

function authHeaders(input: HeadersInit = {}): Headers {
  const headers = new Headers(input);
  if (!isTauri()) return headers;
  headers.set('X-OMI-Native-Client', '1');
  const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new Error(payload.error?.message || `Institution administrator request failed with HTTP ${response.status}.`);
  } catch {
    return new Error(`Institution administrator request failed with HTTP ${response.status}.`);
  }
}
