import type { IntegrationProviderStatus } from '../integrations/contracts';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

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

  if (!response.ok) {
    throw new Error(`Integration connection test failed with HTTP ${response.status}.`);
  }

  return await response.json() as IntegrationProviderStatus;
}
