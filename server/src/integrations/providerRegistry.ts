import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { loadOmiAgentsConfiguration } from './omiAgentsConfig.js';
import { decryptSecret, type EncryptedSecret } from './secretCrypto.js';

export type IntegrationProviderKind =
  | 'translation'
  | 'ai'
  | 'agent'
  | 'storage'
  | 'publishing'
  | 'identity'
  | 'scholarly-service';

export type IntegrationAuthenticationMode =
  | 'none'
  | 'server_secret'
  | 'user_api_key'
  | 'oauth2'
  | 'oidc'
  | 'integration_token';

export interface IntegrationProviderDescriptor {
  id: string;
  kind: IntegrationProviderKind;
  displayName: string;
  description: string;
  authenticationModes: IntegrationAuthenticationMode[];
  preferredAuthenticationMode: IntegrationAuthenticationMode;
  supportsPerUserAuthentication: boolean;
  supportsMultipleConnections: boolean;
  configurable: boolean;
}

export interface IntegrationConnectionStatus {
  healthy: boolean;
  configured: boolean;
  message: string;
}

const providers: IntegrationProviderDescriptor[] = [
  {
    id: 'deepl', kind: 'translation', displayName: 'DeepL',
    description: 'Machine translation for manuscript text and language variants.',
    authenticationModes: ['server_secret', 'user_api_key'],
    preferredAuthenticationMode: 'server_secret', supportsPerUserAuthentication: true,
    supportsMultipleConnections: false, configurable: true,
  },
  {
    id: 'ai-provider', kind: 'ai', displayName: 'AI provider',
    description: 'Provider-neutral AI integration for language and scholarly assistance.',
    authenticationModes: ['server_secret', 'user_api_key', 'oauth2'],
    preferredAuthenticationMode: 'server_secret', supportsPerUserAuthentication: true,
    supportsMultipleConnections: true, configurable: true,
  },
  {
    id: 'omi-agents', kind: 'agent', displayName: 'OMI agents',
    description: 'Scoped OMI assistants for editing, metadata, summaries and citation checks.',
    authenticationModes: ['none'], preferredAuthenticationMode: 'none',
    supportsPerUserAuthentication: true, supportsMultipleConnections: false, configurable: true,
  },
  {
    id: 'ojs', kind: 'publishing', displayName: 'Open Journal Systems (OJS)',
    description: 'Journal publishing integration for manuscript exchange, peer review, assignments and editorial workflow.',
    authenticationModes: ['integration_token'], preferredAuthenticationMode: 'integration_token',
    supportsPerUserAuthentication: true, supportsMultipleConnections: true, configurable: true,
  },
  {
    id: 'omp', kind: 'publishing', displayName: 'Open Monograph Press (OMP)',
    description: 'Monograph publishing integration for books, chapters, contributors, files and editorial workflow.',
    authenticationModes: ['integration_token'], preferredAuthenticationMode: 'integration_token',
    supportsPerUserAuthentication: true, supportsMultipleConnections: true, configurable: true,
  },
  {
    id: 'orcid', kind: 'identity', displayName: 'ORCID',
    description: 'Researcher identity and profile linking.',
    authenticationModes: ['oauth2'], preferredAuthenticationMode: 'oauth2',
    supportsPerUserAuthentication: true, supportsMultipleConnections: false, configurable: true,
  },
  {
    id: 'cloud-storage', kind: 'storage', displayName: 'Cloud storage',
    description: 'Pluggable storage connections for manuscript backups and synchronization.',
    authenticationModes: ['oauth2', 'oidc', 'user_api_key'], preferredAuthenticationMode: 'oauth2',
    supportsPerUserAuthentication: true, supportsMultipleConnections: true, configurable: true,
  },
];

export function listIntegrationProviders(): IntegrationProviderDescriptor[] {
  return providers;
}

export function getIntegrationProvider(providerId: string): IntegrationProviderDescriptor | undefined {
  return providers.find((provider) => provider.id === providerId);
}

function parseEncryptedSecret(value: string): EncryptedSecret {
  const parsed = JSON.parse(value) as Partial<EncryptedSecret>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
    throw new Error('Stored integration secret is invalid.');
  }
  return parsed as EncryptedSecret;
}

async function testDeepL(userId: string): Promise<IntegrationConnectionStatus> {
  const [userConnection, serverConfig] = await Promise.all([
    prisma.userIntegration.findFirst({
      where: { userId, providerId: 'deepl', enabled: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.integrationProviderConfig.findUnique({ where: { providerId: 'deepl' } }),
  ]);

  const encryptedSecret = userConnection?.encryptedSecret ?? serverConfig?.encryptedSecret;
  if (!encryptedSecret) {
    return { configured: false, healthy: false, message: 'DeepL API key is not configured.' };
  }

  try {
    const apiKey = decryptSecret(parseEncryptedSecret(encryptedSecret));
    const endpoint = apiKey.endsWith(':fx')
      ? 'https://api-free.deepl.com/v2/usage'
      : 'https://api.deepl.com/v2/usage';
    const response = await fetch(endpoint, {
      method: 'GET',
      headers: { Authorization: `DeepL-Auth-Key ${apiKey}` },
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) {
      return {
        configured: true,
        healthy: false,
        message: `DeepL rejected the connection test with HTTP ${response.status}.`,
      };
    }
    return { configured: true, healthy: true, message: 'DeepL connection is healthy.' };
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      message: error instanceof Error ? error.message : 'DeepL connection test failed.',
    };
  }
}

function readConfigRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

async function testAiProvider(userId: string): Promise<IntegrationConnectionStatus> {
  const [userConnection, serverConfig] = await Promise.all([
    prisma.userIntegration.findFirst({
      where: { userId, providerId: 'ai-provider', enabled: true },
      orderBy: { updatedAt: 'desc' },
    }),
    prisma.integrationProviderConfig.findUnique({ where: { providerId: 'ai-provider' } }),
  ]);

  const encryptedSecret = userConnection?.encryptedSecret ?? serverConfig?.encryptedSecret;
  const config = readConfigRecord(userConnection?.config ?? serverConfig?.config);
  const endpoint = typeof config?.endpoint === 'string' ? config.endpoint.trim() : '';
  const model = typeof config?.model === 'string' ? config.model.trim() : '';

  if (!encryptedSecret || !endpoint || !model) {
    return {
      configured: false,
      healthy: false,
      message: 'AI provider requires an API secret, an HTTPS chat-completions endpoint, and a model name.',
    };
  }

  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('AI provider endpoint must be a credential-free HTTPS URL.');
    }
    const apiKey = decryptSecret(parseEncryptedSecret(encryptedSecret));
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: 'You are an API connection test. Reply with OK.' },
          { role: 'user', content: 'OK' },
        ],
        temperature: 0,
        max_tokens: 2,
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      return {
        configured: true,
        healthy: false,
        message: `AI provider rejected the live connection test with HTTP ${response.status}.`,
      };
    }
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('application/json')) {
      return {
        configured: true,
        healthy: false,
        message: `AI provider returned ${contentType || 'a non-JSON response'} instead of JSON.`,
      };
    }
    const payload = await response.json() as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    if (!payload.choices?.[0]?.message) {
      return {
        configured: true,
        healthy: false,
        message: 'AI provider returned an unexpected chat-completions response.',
      };
    }
    return {
      configured: true,
      healthy: true,
      message: `AI provider live connection is healthy for model ${model}.`,
    };
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      message: error instanceof Error ? error.message : 'AI provider connection test failed.',
    };
  }
}

async function testOmiAgents(userId: string): Promise<IntegrationConnectionStatus> {
  const state = await loadOmiAgentsConfiguration(userId);
  if (!state.configured) {
    return {
      configured: false,
      healthy: false,
      message: 'OMI Agents are not configured for this account.',
    };
  }
  if (!state.enabled) {
    return {
      configured: true,
      healthy: false,
      message: 'OMI Agents are configured but disabled.',
    };
  }

  const ai = await testAiProvider(userId);
  if (!ai.configured || !ai.healthy) {
    return {
      configured: true,
      healthy: false,
      message: `OMI Agents are configured, but the underlying AI provider is not ready. ${ai.message}`,
    };
  }

  return {
    configured: true,
    healthy: true,
    message: `OMI Agents are ready: ${state.config.enabledAgents.length} agent(s), ${state.config.permissions.length} permission(s), ${state.config.reviewRequired ? 'review required' : 'direct-write policy enabled'}.`,
  };
}

async function testPublishingProvider(
  providerId: 'ojs' | 'omp',
  userId: string,
): Promise<IntegrationConnectionStatus> {
  const connections = await prisma.userIntegration.findMany({
    where: { userId, providerId, enabled: true },
    select: { status: true },
  });
  const connected = connections.filter((connection) => connection.status === 'CONNECTED').length;
  const configured = connections.length;
  return {
    configured: configured > 0,
    healthy: configured > 0 && connected === configured,
    message: configured > 0
      ? `${configured} ${providerId.toUpperCase()} connection(s) configured; ${connected} connected.`
      : `No ${providerId.toUpperCase()} connection is configured for this user.`,
  };
}

export async function testIntegrationProvider(
  providerId: string,
  userId: string,
): Promise<IntegrationConnectionStatus> {
  switch (providerId) {
    case 'deepl':
      return testDeepL(userId);
    case 'ai-provider':
      return testAiProvider(userId);
    case 'omi-agents':
      return testOmiAgents(userId);
    case 'orcid': {
      const identity = await prisma.userIdentity.findFirst({
        where: { userId, provider: 'ORCID' }, select: { id: true },
      });
      const serverConfigured = Boolean(env.ORCID_CLIENT_ID && env.ORCID_CLIENT_SECRET);
      return {
        configured: serverConfigured,
        healthy: serverConfigured && Boolean(identity),
        message: !serverConfigured
          ? 'ORCID OAuth is not configured on this server.'
          : identity
            ? 'ORCID is connected for this user.'
            : 'ORCID OAuth is configured; the user has not connected an ORCID account yet.',
      };
    }
    case 'ojs':
      return testPublishingProvider('ojs', userId);
    case 'omp':
      return testPublishingProvider('omp', userId);
    case 'cloud-storage': {
      const count = await prisma.cloudConnection.count({ where: { userId, status: 'CONNECTED' } });
      return {
        configured: count > 0, healthy: count > 0,
        message: count > 0 ? `${count} cloud storage connection(s) are connected.` : 'No connected cloud storage account is available.',
      };
    }
    default: {
      const connection = await prisma.userIntegration.findFirst({
        where: { userId, providerId, enabled: true }, select: { status: true },
      });
      return {
        configured: Boolean(connection),
        healthy: connection?.status === 'CONNECTED',
        message: connection
          ? connection.status === 'CONNECTED'
            ? 'The integration is configured and connected.'
            : `The integration is configured with status ${connection.status.toLowerCase()}.`
          : 'The integration is not configured for this user.',
      };
    }
  }
}
