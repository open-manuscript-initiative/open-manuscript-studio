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

interface UserResponse {
  user: User;
}

interface ErrorResponse {
  error?: {
    code?: string;
    message?: string;
  };
}

const API_BASE_URL = normalizeBaseUrl(
  import.meta.env?.VITE_API_BASE_URL ?? '',
);

export async function getRegistrationInvitation(
  token: string,
): Promise<RegistrationInvitation> {
  const response = await fetch(
    `${API_BASE_URL}/api/auth/invitations/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok) throw await createApiError(response);
  const payload = (await response.json()) as { invitation: RegistrationInvitation };
  return payload.invitation;
}

export async function registerAccount(
  input: RegisterRequest,
): Promise<User> {
  const response = await request<UserResponse>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  return response.user;
}

export async function loginAccount(
  input: LoginRequest,
): Promise<User> {
  const response = await request<UserResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify(input),
    },
  );

  return response.user;
}

export async function getCurrentAccount(): Promise<User | null> {
  const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw await createApiError(response);
  }

  const payload = (await response.json()) as UserResponse;
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
  const response = await fetch(`${API_BASE_URL}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok && response.status !== 204) {
    throw await createApiError(response);
  }
}

async function request<T>(
  path: string,
  init: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...init.headers,
    },
  });

  if (!response.ok) {
    throw await createApiError(response);
  }

  return (await response.json()) as T;
}

async function createApiError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as ErrorResponse;
    return new Error(
      payload.error?.message ||
        `Authentication request failed with HTTP ${response.status}.`,
    );
  } catch {
    return new Error(
      `Authentication request failed with HTTP ${response.status}.`,
    );
  }
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}
