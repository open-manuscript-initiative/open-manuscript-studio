import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requestAiText, resolveAiEndpoint } from './aiProviderClient.js';
import { loadOmiAgentsConfiguration } from './omiAgentsConfig.js';
import { testReferenceManagerConnection } from './referenceManagers/referenceManagerService.js';
import { decryptSecret, type EncryptedSecret } from './secretCrypto.js';
import { assertTrustedIntegrationUrl } from './security/trustedRemoteUrl.js';

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
    id: 'wordpress', kind: 'publishing', displayName: 'WordPress',
    description: 'Deliver committed semantic HTML5 artifacts with an explicit peer-review assurance seal through the WordPress REST API using a personal application password.',
    authenticationModes: ['user_api_key'], preferredAuthenticationMode: 'user_api_key',
    supportsPerUserAuthentication: true, supportsMultipleConnections: true, configurable: true,
  },
  {
    id: 'web-publishing', kind: 'publishing', displayName: 'Generic web publishing endpoint',
    description: 'Deliver committed semantic HTML5 artifacts with explicit peer-review assurance through the omi-web-publication/1 JSON contract using no authentication, Bearer, X-API-Key, or Basic authentication.',
    authenticationModes: ['none', 'user_api_key'], preferredAuthenticationMode: 'user_api_key',
    supportsPerUserAuthentication: true, supportsMultipleConnections: true, configurable: true,
  },
  {
    id: 'zotero', kind: 'scholarly-service', displayName: 'Zotero',
    description: 'Personal Zotero reference-library integration.',
    authenticationModes: ['user_api_key'], preferredAuthenticationMode: 'user_api_key',
    supportsPerUserAuthentication: true, supportsMultipleConnections: false, configurable: true,
  },
  {
    id: 'mendeley', kind: 'scholarly-service', displayName: 'Mendeley',
    description: 'Personal Mendeley reference-library integration.',
    authenticationModes: ['oauth2'], preferredAuthenticationMode: 'oauth2',
    supportsPerUserAuthentication: true, supportsMultipleConnections: false, configurable: true,
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
  const endpoint = resolveAiEndpoint(config ?? {});
  const model = typeof config?.model === 'string' ? config.model.trim() : '';
  const providerPreset = typeof config?.providerPreset === 'string' ? config.providerPreset : undefined;

  if (!encryptedSecret || !endpoint || !model) {
    return {
      configured: false,
      healthy: false,
      message: 'AI provider requires an API secret, an HTTPS endpoint, and a model name.',
    };
  }

  try {
    const url = new URL(endpoint);
    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new Error('AI provider endpoint must be a credential-free HTTPS URL.');
    }
    const apiKey = decryptSecret(parseEncryptedSecret(encryptedSecret));
    await requestAiText({
      endpoint: url.toString(),
      providerPreset,
      model,
      apiKey,
      systemPrompt: 'You are an API connection test. Reply with OK.',
      userPrompt: 'OK',
      timeoutMs: 15000,
      maxOutputTokens: 16,
    });
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

async function testWebPublishingProvider(
  providerId: 'wordpress' | 'web-publishing',
  userId: string,
): Promise<IntegrationConnectionStatus> {
  const connections = await prisma.userIntegration.findMany({
    where: { userId, providerId, enabled: true },
  });
  if (connections.length === 0) {
    return {
      configured: false,
      healthy: false,
      message: providerId === 'wordpress'
        ? 'No WordPress publishing target is configured.'
        : 'No generic web publishing target is configured.',
    };
  }

  try {
    for (const connection of connections) {
      const config = readConfigRecord(connection.config) ?? {};
      const endpoint = providerId === 'wordpress'
        ? (typeof config.baseUrl === 'string' ? config.baseUrl.trim() : '')
        : (typeof config.endpoint === 'string' ? config.endpoint.trim() : '');
      if (!endpoint) {
        throw new Error('A configured web publishing target is missing its HTTPS URL.');
      }
      await assertTrustedIntegrationUrl(endpoint, endpoint);

      const secret = connection.encryptedSecret
        ? decryptSecret(parseEncryptedSecret(connection.encryptedSecret))
        : null;
      if (providerId === 'wordpress') {
        const username = typeof config.username === 'string' ? config.username.trim() : '';
        if (!username || !secret) {
          throw new Error('WordPress publishing requires a username and application password.');
        }
      } else {
        const scheme = typeof config.authScheme === 'string' ? config.authScheme : 'bearer';
        if (scheme !== 'none' && connection.authenticationMode !== 'none' && !secret) {
          throw new Error('The generic publishing target is missing its stored credential.');
        }
        if (!['none', 'bearer', 'x-api-key', 'basic'].includes(scheme)) {
          throw new Error('The generic publishing authentication scheme is invalid.');
        }
        if (scheme === 'basic') {
          const username = typeof config.username === 'string' ? config.username.trim() : '';
          if (!username) throw new Error('Basic authentication requires a username.');
        }
      }
    }
    return {
      configured: true,
      healthy: true,
      message: `${connections.length} web publishing target(s) have valid encrypted configuration and a public HTTPS endpoint.`,
    };
  } catch (error) {
    return {
      configured: true,
      healthy: false,
      message: error instanceof Error ? error.message : 'Web publishing configuration validation failed.',
    };
  }
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
    case 'zotero':
      return testReferenceManagerConnection(userId, 'zotero');
    case 'mendeley':
      return testReferenceManagerConnection(userId, 'mendeley');
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
    case 'wordpress':
      return testWebPublishingProvider('wordpress', userId);
    case 'web-publishing':
      return testWebPublishingProvider('web-publishing', userId);
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
