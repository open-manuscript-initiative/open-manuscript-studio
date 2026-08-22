import { isTauri } from '@tauri-apps/api/core';

import type {
  UpdateUserProfileInput,
  User,
} from '../model/user';

export interface RegisterRequest {
  email: string;
  password: string;
  fullName: string;
  affiliation?: string;
  affiliationRorId?: string;
  orcid?: string;
  interfaceLanguage?: string;
  invitationToken?: string;
}

export interface RegistrationInvitation {
  email: string;
  fullName: string;
  expiresAt: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface AuthProviders {
  orcid: {
    enabled: boolean;
    label: string;
    environment?: 'sandbox' | 'production';
    issuer?: string;
    credentialSource?: 'personal' | 'institutional';
    apiType?: 'public' | 'member';
    linked?: boolean;
    identity?: {
      id: string;
      providerUserId: string;
      displayName?: string | null;
      connectedAt: string;
    } | null;
  };
}

interface UserResponse {
  user: User;
}

interface NativeSessionResponse extends UserResponse {
  token?: string;
  expiresAt?: string;
}

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_AUTH_CODE_PARAM = 'nativeAuthCode';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';
const IS_TAURI = detectTauriRuntime();
const USE_DIRECT_NATIVE_API = IS_TAURI && !import.meta.env.DEV;

const API_BASE_URL = normalizeBaseUrl(
  import.meta.env?.VITE_API_BASE_URL ??
    (USE_DIRECT_NATIVE_API ? NATIVE_API_BASE_URL : ''),
);

export async function getAuthProviders(): Promise<AuthProviders> {
  const response = await fetch(`${API_BASE_URL}/api/auth/providers`, {
    method: 'GET',
    credentials: 'include',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!response.ok) throw await createApiError(response);
  const payload = await parseJsonResponse<{ providers: AuthProviders }>(response);
  return payload.providers;
}

export function getOrcidAuthUrl(input?: {
  invitationToken?: string;
}): string {
  const params = new URLSearchParams();
  if (input?.invitationToken) {
    params.set('mode', 'invite');
    params.set('invite', input.invitationToken);
  } else {
    params.set('mode', 'login');
  }
  appendNativeOrcidParams(params);
  return `${API_BASE_URL}/api/auth/orcid/start?${params.toString()}`;
}

export function getOrcidLinkUrl(): string {
  const params = new URLSearchParams({ mode: 'link' });
  appendNativeOrcidParams(params);
  return `${API_BASE_URL}/api/auth/orcid/start?${params.toString()}`;
}

export async function consumeNativeOrcidHandoffFromLocation(): Promise<User | null> {
  if (!IS_TAURI) return null;

  const code = readLocationFragmentParam(NATIVE_AUTH_CODE_PARAM)?.trim();
  if (!code) return null;

  try {
    const response = await request<NativeSessionResponse>(
      '/api/auth/orcid/native/exchange',
      {
        method: 'POST',
        body: JSON.stringify({ code }),
      },
    );

    if (!response.token) {
      throw new Error('The native ORCID session token was not returned by the Studio API.');
    }

    persistNativeSession(response);
    return response.user;
  } finally {
    removeLocationFragmentParam(NATIVE_AUTH_CODE_PARAM);
  }
}

export function getAuthErrorCodeFromLocation(): string | null {
  const queryValue = new URLSearchParams(globalThis.location?.search ?? '').get('authError');
  return queryValue ?? readLocationFragmentParam('authError');
}

export async function unlinkOrcid(): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/auth/orcid/link`, {
    method: 'DELETE',
    credentials: 'include',
    headers: authHeaders({ Accept: 'application/json' }),
  });
  if (!response.ok && response.status !== 204) {
    throw await createApiError(response);
  }
}

export async function getRegistrationInvitation(
  token: string,
): Promise<RegistrationInvitation> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/invitations/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: authHeaders({ Accept: 'application/json' }),
    },
  );
  if (!response.ok) throw await createApiError(response);
  const payload = await parseJsonResponse<{ invitation: RegistrationInvitation }>(response);
  return payload.invitation;
}

export async function registerAccount(
  input: RegisterRequest,
): Promise<User> {
  const response = await request<NativeSessionResponse>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  persistNativeSession(response);
  return response.user;
}

export async function loginAccount(
  input: LoginRequest,
): Promise<User> {
  const response = await request<NativeSessionResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  persistNativeSession(response);
  return response.user;
}

export async function getCurrentAccount(): Promise<User | null> {
  if (IS_TAURI && !getNativeSessionToken()) {
    return null;
  }

  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: authHeaders({ Accept: 'application/json' }),
  });

  if (response.status === 401) {
    if (IS_TAURI) clearNativeSession();
    return null;
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  const payload = await parseJsonResponse<UserResponse>(response);
  return payload.user;
}

export async function updateCurrentAccount(
  input: UpdateUserProfileInput,
): Promise<User> {
  const payload = {
    fullName: input.fullName,
    affiliation:
      input.affiliation !== undefined
        ? input.affiliation.trim() || null
        : undefined,
    affiliationRorId:
      input.affiliationRorId !== undefined
        ? input.affiliationRorId.trim() || null
        : undefined,
    orcid:
      input.orcid !== undefined
        ? input.orcid.trim() || null
        : undefined,
    interfaceLanguage: input.interfaceLanguage,
  };

  const response = await request<UserResponse>(
    '/api/auth/me',
    {
      method: 'PATCH',
      body: JSON.stringify(payload),
    },
  );

  return response.user;
}

export async function logoutAccount(): Promise<void> {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: authHeaders({ Accept: 'application/json' }),
    });

    if (!response.ok && response.status !== 204) {
      throw await createApiError(response);
    }
  } finally {
    if (IS_TAURI) clearNativeSession();
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: authHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    }),
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  return parseJsonResponse<T>(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).trim().slice(0, 80);
    throw new Error(
      `Authentication API returned ${contentType || 'an unknown content type'} from ${response.url || 'the requested endpoint'} instead of JSON${preview ? `: ${preview}` : '.'}`,
    );
  }

  return (await response.json()) as T;
}

async function createApiError(response: Response): Promise<Error> {
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      const payload = (await response.json()) as ErrorResponse;
      return new Error(
        payload.error?.message ||
          `Authentication request failed with HTTP ${response.status}.`,
      );
    } catch {
      // Fall through to the generic HTTP error below.
    }
  }

  return new Error(
    `Authentication request failed with HTTP ${response.status}.`,
  );
}

function authHeaders(input: HeadersInit = {}): Headers {
  const headers = new Headers(input);
  if (!IS_TAURI) return headers;

  headers.set('X-OMI-Native-Client', '1');
  const token = getNativeSessionToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

function persistNativeSession(response: NativeSessionResponse): void {
  if (!IS_TAURI || !response.token) return;
  globalThis.localStorage?.setItem(NATIVE_SESSION_KEY, response.token);
}

function getNativeSessionToken(): string | null {
  if (!IS_TAURI) return null;
  return globalThis.localStorage?.getItem(NATIVE_SESSION_KEY) ?? null;
}

function clearNativeSession(): void {
  globalThis.localStorage?.removeItem(NATIVE_SESSION_KEY);
}

function appendNativeOrcidParams(params: URLSearchParams): void {
  const returnOrigin = getNativeReturnOrigin();
  if (!returnOrigin) return;

  params.set('native', '1');
  params.set('return_origin', returnOrigin);
}

function getNativeReturnOrigin(): string | undefined {
  if (!IS_TAURI) return undefined;

  const location = globalThis.location;
  if (!location) return undefined;

  if (location.hostname === 'tauri.localhost') {
    return `${location.protocol}//${location.host}`;
  }
  if (location.protocol === 'tauri:') {
    return 'tauri://localhost';
  }

  return undefined;
}

function readLocationFragmentParam(name: string): string | null {
  const hash = globalThis.location?.hash ?? '';
  if (!hash) return null;
  return new URLSearchParams(hash.replace(/^#/, '')).get(name);
}

function removeLocationFragmentParam(name: string): void {
  const location = globalThis.location;
  const history = globalThis.history;
  if (!location || !history) return;

  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  if (!params.has(name)) return;
  params.delete(name);

  const hash = params.toString();
  const nextUrl = `${location.pathname}${location.search}${hash ? `#${hash}` : ''}`;
  history.replaceState(history.state, '', nextUrl);
}

function detectTauriRuntime(): boolean {
  if (isTauri()) return true;

  const location = globalThis.location;
  if (!location) return false;

  return (
    location.protocol === 'tauri:' ||
    location.hostname === 'tauri.localhost'
  );
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}
