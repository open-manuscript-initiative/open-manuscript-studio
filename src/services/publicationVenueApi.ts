import { isTauri } from '@tauri-apps/api/core';

import type {
  OmiPublicationVenueReference,
  OmiPublicationVenueType,
} from '../model/scholarlyMetadata';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org';

export interface CreatePublicationVenueInput {
  type: OmiPublicationVenueType;
  name: string;
  website?: string;
  issn?: string;
  isbnPrefix?: string;
  integrationConnectionId: string;
}

export interface CreatePublicationVenueDomainClaimInput {
  type: OmiPublicationVenueType;
  name: string;
  domain: string;
  website?: string;
  issn?: string;
  isbnPrefix?: string;
}

export interface PublicationVenueDomainChallenge {
  claimId: string;
  venueId: string;
  domain: string;
  txtName: string;
  txtValue: string;
  expiresAt: string;
}

export type PublicationVenueAuthorityRole =
  | 'DOMAIN_ADMIN'
  | 'EDITOR_IN_CHIEF'
  | 'EDITOR';

export interface PublicationVenueAuthorityMember {
  id: string;
  role: PublicationVenueAuthorityRole;
  active: boolean;
  user: {
    id: string;
    email: string;
    fullName: string;
  };
}

export interface PublicationVenueAuthorityOverview {
  verifiedDomains: Array<{
    verificationId: string;
    domain: string;
    method: 'DNS_TXT';
    verifiedAt: string | null;
    lastCheckedAt: string | null;
  }>;
  currentMemberships: Array<{
    id: string;
    role: PublicationVenueAuthorityRole;
    active: boolean;
  }>;
  canManageMembers: boolean;
  members: PublicationVenueAuthorityMember[];
}

export async function getPublicationVenues(
  type?: OmiPublicationVenueType,
  query?: string,
): Promise<OmiPublicationVenueReference[]> {
  const params = new URLSearchParams();
  if (type) params.set('type', type);
  if (query?.trim()) params.set('q', query.trim());
  const queryString = params.toString();
  const path = '/api/auth/publication-venues'
    + (queryString ? '?' + queryString : '');
  const response = await fetch(apiBaseUrl() + path, {
    method: 'GET',
    credentials: 'include',
    headers: headers(),
  });
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as {
    venues?: OmiPublicationVenueReference[];
  };
  return payload.venues ?? [];
}

export async function createPublicationVenue(
  input: CreatePublicationVenueInput,
): Promise<OmiPublicationVenueReference> {
  const response = await jsonRequest('/api/auth/publication-venues', 'POST', input);
  const payload = await response.json() as {
    venue: OmiPublicationVenueReference;
  };
  return payload.venue;
}

export async function createPublicationVenueDomainClaim(
  input: CreatePublicationVenueDomainClaimInput,
): Promise<{
  venue: OmiPublicationVenueReference;
  challenge: PublicationVenueDomainChallenge;
}> {
  const response = await jsonRequest(
    '/api/auth/publication-venues/domain-claims',
    'POST',
    input,
  );
  return response.json() as Promise<{
    venue: OmiPublicationVenueReference;
    challenge: PublicationVenueDomainChallenge;
  }>;
}

export async function verifyPublicationVenueDomainClaim(
  claimId: string,
): Promise<OmiPublicationVenueReference> {
  const response = await jsonRequest(
    '/api/auth/publication-venues/domain-claims/'
      + encodeURIComponent(claimId)
      + '/verify',
    'POST',
    {},
  );
  const payload = await response.json() as {
    venue: OmiPublicationVenueReference;
  };
  return payload.venue;
}

export async function getPublicationVenueAuthority(
  venueId: string,
): Promise<PublicationVenueAuthorityOverview> {
  const response = await fetch(
    apiBaseUrl()
      + '/api/auth/publication-venues/'
      + encodeURIComponent(venueId)
      + '/authority',
    {
      method: 'GET',
      credentials: 'include',
      headers: headers(),
    },
  );
  if (!response.ok) throw await apiError(response);
  const payload = await response.json() as {
    authority: PublicationVenueAuthorityOverview;
  };
  return payload.authority;
}

export async function grantPublicationVenueMember(
  venueId: string,
  input: {
    email: string;
    role: PublicationVenueAuthorityRole;
  },
): Promise<PublicationVenueAuthorityMember> {
  const response = await jsonRequest(
    '/api/auth/publication-venues/'
      + encodeURIComponent(venueId)
      + '/members',
    'POST',
    input,
  );
  const payload = await response.json() as {
    member: PublicationVenueAuthorityMember;
  };
  return payload.member;
}

export async function revokePublicationVenueMembership(
  venueId: string,
  membershipId: string,
): Promise<void> {
  const response = await fetch(
    apiBaseUrl()
      + '/api/auth/publication-venues/'
      + encodeURIComponent(venueId)
      + '/members/'
      + encodeURIComponent(membershipId),
    {
      method: 'DELETE',
      credentials: 'include',
      headers: headers(),
    },
  );
  if (!response.ok && response.status !== 204) throw await apiError(response);
}

async function jsonRequest(
  path: string,
  method: 'POST' | 'PUT',
  body: unknown,
): Promise<Response> {
  const requestHeaders = headers();
  requestHeaders.set('Content-Type', 'application/json');
  const response = await fetch(apiBaseUrl() + path, {
    method,
    credentials: 'include',
    headers: requestHeaders,
    body: JSON.stringify(body),
  });
  if (!response.ok) throw await apiError(response);
  return response;
}

function apiBaseUrl(): string {
  const configured = import.meta.env?.VITE_API_BASE_URL?.trim();
  if (configured) return configured.replace(/\/+$/, '');
  return isTauri() && !import.meta.env.DEV
    ? NATIVE_API_BASE_URL
    : '';
}

function headers(): Headers {
  const result = new Headers({ Accept: 'application/json' });
  if (isTauri()) {
    result.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
    if (token) result.set('Authorization', 'Bearer ' + token);
  }
  return result;
}

async function apiError(response: Response): Promise<Error> {
  try {
    const payload = await response.json() as { error?: { message?: string } };
    return new Error(
      payload.error?.message
        || 'Publication venue request failed with HTTP ' + response.status + '.',
    );
  } catch {
    return new Error(
      'Publication venue request failed with HTTP ' + response.status + '.',
    );
  }
}
