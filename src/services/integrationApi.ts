import type {
  IntegrationAuthenticationMode,
  IntegrationProviderStatus,
} from '../integrations/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export interface IntegrationConnection {
  id: string;
  providerId: string;
  connectionKey: string;
  displayName: string | null;
  authenticationMode: IntegrationAuthenticationMode;
  enabled: boolean;
  status: string;
  config: Record<string, unknown> | null;
  hasSecret: boolean;
  lastCheckedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntegrationCatalogProvider {
  id: string;
  kind: string;
  displayName: string;
  description: string;
  authenticationModes: IntegrationAuthenticationMode[];
  preferredAuthenticationMode: IntegrationAuthenticationMode;
  supportsPerUserAuthentication: boolean;
  supportsMultipleConnections: boolean;
  configurable: boolean;
  server: {
    enabled: boolean;
    configured: boolean;
    status: string;
    lastCheckedAt: string | null;
    lastError: string | null;
  };
  connections: IntegrationConnection[];
}

export interface PublishingConnectionCredentials {
  installationId: string;
  sharedSecret: string;
}

async function readErrorMessage(response: Response): Promise<string | undefined> {
  const body = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  return body?.error?.message;
}

export async function getIntegrationStatus(
  providerId: string,
): Promise<IntegrationProviderStatus> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/status`,
    {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );

  if (!response.ok) {
    if (response.status === 404) {
      return {
        providerId,
        enabled: false,
        configured: false,
        healthy: false,
        message: 'Integration endpoint is not configured on this Studio server.',
      };
    }
    throw new Error(`Integration status request failed with HTTP ${response.status}.`);
  }

  return await response.json() as IntegrationProviderStatus;
}

export async function getIntegrationCatalog(): Promise<IntegrationCatalogProvider[]> {
  const response = await fetch(`${API_BASE_URL}/integrations/catalog`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration catalog request failed with HTTP ${response.status}.`,
    );
  }
  const payload = await response.json() as { providers: IntegrationCatalogProvider[] };
  return payload.providers;
}

export async function saveIntegrationConnection(
  providerId: string,
  input: {
    connectionKey?: string;
    displayName?: string;
    authenticationMode: IntegrationAuthenticationMode;
    secret?: string;
    config?: Record<string, unknown>;
    enabled?: boolean;
  },
): Promise<IntegrationConnection> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/connections`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration configuration failed with HTTP ${response.status}.`,
    );
  }
  const payload = await response.json() as { connection: IntegrationConnection };
  return payload.connection;
}

export async function createPublishingConnection(
  providerId: 'ojs' | 'omp',
  input: { displayName: string; baseUrl: string },
): Promise<{
  connection: IntegrationConnection;
  credentials: PublishingConnectionCredentials;
}> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/publishing-connections`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Publishing connection registration failed with HTTP ${response.status}.`,
    );
  }
  return await response.json() as {
    connection: IntegrationConnection;
    credentials: PublishingConnectionCredentials;
  };
}

export async function updatePublishingConnection(
  connectionId: string,
  input: { displayName: string; baseUrl: string },
): Promise<IntegrationConnection> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/connections/${encodeURIComponent(connectionId)}/publishing`,
    {
      method: 'PUT',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(input),
    },
  );
  if (!response.ok) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Publishing connection update failed with HTTP ${response.status}.`,
    );
  }
  const payload = await response.json() as { connection: IntegrationConnection };
  return payload.connection;
}

export async function testIntegrationConnection(
  providerId: string,
): Promise<IntegrationProviderStatus> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/${encodeURIComponent(providerId)}/test`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );

  if (!response.ok && response.status !== 409) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration connection test failed with HTTP ${response.status}.`,
    );
  }

  const payload = await response.json() as {
    status?: { healthy: boolean; configured: boolean; message: string };
    providerId?: string;
    enabled?: boolean;
    configured?: boolean;
    healthy?: boolean;
    message?: string;
  };

  if (payload.status) {
    return {
      providerId,
      enabled: true,
      configured: payload.status.configured,
      healthy: payload.status.healthy,
      message: payload.status.message,
    };
  }
  return payload as IntegrationProviderStatus;
}

export async function testIntegrationConnectionById(
  connectionId: string,
): Promise<IntegrationConnection> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/connections/${encodeURIComponent(connectionId)}/test`,
    {
      method: 'POST',
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: '{}',
    },
  );
  if (!response.ok && response.status !== 409) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration connection test failed with HTTP ${response.status}.`,
    );
  }
  const payload = await response.json() as { connection: IntegrationConnection };
  return payload.connection;
}

export async function deleteIntegrationConnection(connectionId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/connections/${encodeURIComponent(connectionId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw new Error(
      (await readErrorMessage(response)) ??
      `Integration deletion failed with HTTP ${response.status}.`,
    );
  }
}
