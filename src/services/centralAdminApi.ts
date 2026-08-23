import { isTauri } from '@tauri-apps/api/core';

export type CentralAdminRole = 'ADMIN' | 'OWNER';
export type InstitutionStatus = 'ACTIVE' | 'DISABLED';
export type InstitutionAdminRole = 'ADMIN' | 'OWNER';
export type InstitutionApiScope =
  | 'institution:read'
  | 'members:read'
  | 'members:write'
  | 'integrations:read'
  | 'integrations:write';

export interface CentralAdminContext {
  centralAdmin: boolean;
  role: CentralAdminRole | null;
}

export interface CentralInstitution {
  id: string;
  name: string;
  rorId: string | null;
  status: InstitutionStatus;
  memberCount: number;
  apiCredentialCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CentralInstitutionAdmin {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  role: InstitutionAdminRole;
  institutionalEmail: string | null;
  identityId: string | null;
  identityProvider: 'ORCID' | 'OIDC' | 'SAML' | null;
  identityDisplayName: string | null;
  createdAt: string;
}

export interface InstitutionApiCredential {
  id: string;
  institutionId: string;
  label: string;
  tokenPrefix: string;
  scopes: InstitutionApiScope[];
  status: 'ACTIVE' | 'REVOKED';
  expiresAt: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  revokedAt: string | null;
}

export interface CentralAuditEvent {
  id: string;
  actorUserId: string | null;
  apiCredentialId: string | null;
  institutionId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  details: unknown;
  ipAddress: string | null;
  createdAt: string;
}

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export async function getCentralAdminContext(): Promise<CentralAdminContext> {
  return request<CentralAdminContext>('/api/central-admin/context');
}

export async function getCentralInstitutions(): Promise<CentralInstitution[]> {
  const payload = await request<{ institutions: CentralInstitution[] }>('/api/central-admin/institutions');
  return payload.institutions;
}

export async function createCentralInstitution(input: {
  name: string;
  rorId?: string | null;
}): Promise<CentralInstitution> {
  const payload = await request<{ institution: CentralInstitution }>('/api/central-admin/institutions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  return payload.institution;
}

export async function updateCentralInstitution(
  institutionId: string,
  input: { name?: string; rorId?: string | null; status?: InstitutionStatus },
): Promise<void> {
  await request(`/api/central-admin/institutions/${encodeURIComponent(institutionId)}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export async function getCentralInstitutionAdmins(institutionId: string): Promise<CentralInstitutionAdmin[]> {
  const payload = await request<{ admins: CentralInstitutionAdmin[] }>(
    `/api/central-admin/institutions/${encodeURIComponent(institutionId)}/admins`,
  );
  return payload.admins;
}

export async function addCentralInstitutionAdmin(
  institutionId: string,
  email: string,
  role: InstitutionAdminRole,
): Promise<void> {
  await request(`/api/central-admin/institutions/${encodeURIComponent(institutionId)}/admins`, {
    method: 'POST',
    body: JSON.stringify({ email, role }),
  });
}

export async function removeCentralInstitutionAdmin(
  institutionId: string,
  membershipId: string,
): Promise<void> {
  await request(
    `/api/central-admin/institutions/${encodeURIComponent(institutionId)}/admins/${encodeURIComponent(membershipId)}`,
    { method: 'DELETE' },
  );
}

export async function getInstitutionApiCredentials(institutionId: string): Promise<InstitutionApiCredential[]> {
  const payload = await request<{ credentials: InstitutionApiCredential[] }>(
    `/api/central-admin/institutions/${encodeURIComponent(institutionId)}/api-credentials`,
  );
  return payload.credentials;
}

export async function createInstitutionApiCredential(input: {
  institutionId: string;
  label: string;
  scopes: InstitutionApiScope[];
  expiresInDays?: number;
}): Promise<{ credential: InstitutionApiCredential; token: string; tokenVisibleOnce: true }> {
  return request<{ credential: InstitutionApiCredential; token: string; tokenVisibleOnce: true }>(
    `/api/central-admin/institutions/${encodeURIComponent(input.institutionId)}/api-credentials`,
    {
      method: 'POST',
      body: JSON.stringify({
        label: input.label,
        scopes: input.scopes,
        ...(input.expiresInDays !== undefined ? { expiresInDays: input.expiresInDays } : {}),
      }),
    },
  );
}

export async function revokeInstitutionApiCredential(
  institutionId: string,
  credentialId: string,
): Promise<void> {
  await request(
    `/api/central-admin/institutions/${encodeURIComponent(institutionId)}/api-credentials/${encodeURIComponent(credentialId)}`,
    { method: 'DELETE' },
  );
}

export async function getCentralAuditEvents(institutionId?: string): Promise<CentralAuditEvent[]> {
  const params = new URLSearchParams({ limit: '100' });
  if (institutionId) params.set('institutionId', institutionId);
  const payload = await request<{ events: CentralAuditEvent[] }>(`/api/central-admin/audit?${params.toString()}`);
  return payload.events;
}

async function request<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${apiBaseUrl()}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  });
  if (!response.ok) throw await apiError(response);
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

function apiBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isTauri() && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '';
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new Error(payload.error?.message || `Central administration request failed with HTTP ${response.status}.`);
  } catch {
    return new Error(`Central administration request failed with HTTP ${response.status}.`);
  }
}
