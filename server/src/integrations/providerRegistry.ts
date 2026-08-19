import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';

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
  configurable: boolean;
}

export interface IntegrationConnectionStatus {
  healthy: boolean;
  configured: boolean;
  message: string;
}

const providers: IntegrationProviderDescriptor[] = [
  {
    id: 'deepl',
    kind: 'translation',
    displayName: 'DeepL',
    description: 'Machine translation for manuscript text and language variants.',
    authenticationModes: ['server_secret', 'user_api_key'],
    preferredAuthenticationMode: 'server_secret',
    supportsPerUserAuthentication: true,
    configurable: true,
  },
  {
    id: 'ai-provider',
    kind: 'ai',
    displayName: 'AI provider',
    description: 'Provider-neutral AI integration for language and scholarly assistance.',
    authenticationModes: ['server_secret', 'user_api_key', 'oauth2'],
    preferredAuthenticationMode: 'server_secret',
    supportsPerUserAuthentication: true,
    configurable: true,
  },
  {
    id: 'omi-agents',
    kind: 'agent',
    displayName: 'OMI agents',
    description: 'Scoped OMI assistants for editing, metadata, summaries and citation checks.',
    authenticationModes: ['none'],
    preferredAuthenticationMode: 'none',
    supportsPerUserAuthentication: false,
    configurable: false,
  },
  {
    id: 'ojs-omp',
    kind: 'publishing',
    displayName: 'OJS / OMP',
    description: 'Publishing-system integration for manuscript exchange and editorial workflow.',
    authenticationModes: ['integration_token'],
    preferredAuthenticationMode: 'integration_token',
    supportsPerUserAuthentication: false,
    configurable: false,
  },
  {
    id: 'orcid',
    kind: 'identity',
    displayName: 'ORCID',
    description: 'Researcher identity and profile linking.',
    authenticationModes: ['oauth2'],
    preferredAuthenticationMode: 'oauth2',
    supportsPerUserAuthentication: true,
    configurable: true,
  },
  {
    id: 'cloud-storage',
    kind: 'storage',
    displayName: 'Cloud storage',
    description: 'Pluggable storage connections for manuscript backups and synchronization.',
    authenticationModes: ['oauth2', 'oidc', 'user_api_key'],
    preferredAuthenticationMode: 'oauth2',
    supportsPerUserAuthentication: true,
    configurable: true,
  },
];

export function listIntegrationProviders(): IntegrationProviderDescriptor[] {
  return providers;
}

export function getIntegrationProvider(providerId: string): IntegrationProviderDescriptor | undefined {
  return providers.find((provider) => provider.id === providerId);
}

export async function testIntegrationProvider(
  providerId: string,
  userId: string,
): Promise<IntegrationConnectionStatus> {
  switch (providerId) {
    case 'orcid': {
      const identity = await prisma.userIdentity.findFirst({
        where: { userId, provider: 'ORCID' },
        select: { id: true },
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
    case 'ojs-omp': {
      const count = await prisma.externalInstallation.count({
        where: { status: 'ACTIVE' },
      });
      return {
        configured: count > 0,
        healthy: count > 0,
        message: count > 0
          ? `${count} active OJS/OMP installation(s) configured.`
          : 'No active OJS/OMP installation is configured.',
      };
    }
    case 'cloud-storage': {
      const count = await prisma.cloudConnection.count({
        where: { userId, status: 'CONNECTED' },
      });
      return {
        configured: count > 0,
        healthy: count > 0,
        message: count > 0
          ? `${count} cloud storage connection(s) are connected.`
          : 'No connected cloud storage account is available.',
      };
    }
    default: {
      const connection = await prisma.userIntegration.findFirst({
        where: { userId, providerId, enabled: true },
        select: { status: true },
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
