import { prisma } from '../lib/prisma.js';

export type OmiBuiltInAgentId =
  | 'language-editor'
  | 'metadata-assistant'
  | 'summarizer'
  | 'citation-checker';

export type OmiAgentPermission =
  | 'document.read'
  | 'document.suggest'
  | 'document.write'
  | 'metadata.read'
  | 'metadata.write'
  | 'references.read';

export interface OmiAgentsConfiguration {
  version: 1;
  enabledAgents: OmiBuiltInAgentId[];
  permissions: OmiAgentPermission[];
  reviewRequired: boolean;
}

export const DEFAULT_OMI_AGENTS_CONFIGURATION: OmiAgentsConfiguration = {
  version: 1,
  enabledAgents: [
    'language-editor',
    'metadata-assistant',
    'summarizer',
    'citation-checker',
  ],
  permissions: [
    'document.read',
    'document.suggest',
    'metadata.read',
    'references.read',
  ],
  reviewRequired: true,
};

const VALID_AGENTS = new Set<OmiBuiltInAgentId>(DEFAULT_OMI_AGENTS_CONFIGURATION.enabledAgents);
const VALID_PERMISSIONS = new Set<OmiAgentPermission>([
  'document.read',
  'document.suggest',
  'document.write',
  'metadata.read',
  'metadata.write',
  'references.read',
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function unique<T extends string>(items: T[]): T[] {
  return Array.from(new Set(items));
}

export function parseOmiAgentsConfiguration(value: unknown): OmiAgentsConfiguration | null {
  const record = asRecord(value);
  if (!record) return null;

  const rawAgents = Array.isArray(record.enabledAgents) ? record.enabledAgents : [];
  const rawPermissions = Array.isArray(record.permissions) ? record.permissions : [];
  const enabledAgents = unique(rawAgents.filter(
    (item): item is OmiBuiltInAgentId => typeof item === 'string' && VALID_AGENTS.has(item as OmiBuiltInAgentId),
  ));
  const permissions = unique(rawPermissions.filter(
    (item): item is OmiAgentPermission => typeof item === 'string' && VALID_PERMISSIONS.has(item as OmiAgentPermission),
  ));

  if (!enabledAgents.length || !permissions.length) return null;

  return {
    version: 1,
    enabledAgents,
    permissions,
    reviewRequired: record.reviewRequired !== false,
  };
}

export async function loadOmiAgentsConfiguration(userId: string): Promise<{
  configured: boolean;
  enabled: boolean;
  config: OmiAgentsConfiguration;
}> {
  const connection = await prisma.userIntegration.findFirst({
    where: {
      userId,
      providerId: 'omi-agents',
      connectionKey: 'default',
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (!connection) {
    return {
      configured: false,
      enabled: false,
      config: DEFAULT_OMI_AGENTS_CONFIGURATION,
    };
  }

  const config = parseOmiAgentsConfiguration(connection.config);
  return {
    configured: Boolean(config),
    enabled: connection.enabled && Boolean(config),
    config: config ?? DEFAULT_OMI_AGENTS_CONFIGURATION,
  };
}

function requiredReadPermission(scopeKind: string): OmiAgentPermission {
  if (scopeKind === 'metadata') return 'metadata.read';
  if (scopeKind === 'references') return 'references.read';
  return 'document.read';
}

export async function assertOmiAgentRunAllowed(input: {
  userId: string;
  agentId: OmiBuiltInAgentId;
  scopeKind: string;
  requestedPermissions: string[];
  allowDirectWrite: boolean | undefined;
}): Promise<OmiAgentsConfiguration> {
  const state = await loadOmiAgentsConfiguration(input.userId);
  if (!state.configured) {
    throw new Error('OMI Agents are not configured for this account. Open Integrations → OMI Agents first.');
  }
  if (!state.enabled) throw new Error('OMI Agents are disabled for this account.');
  if (!state.config.enabledAgents.includes(input.agentId)) {
    throw new Error(`The OMI agent “${input.agentId}” is disabled.`);
  }

  const granted = new Set(state.config.permissions);
  const requiredRead = requiredReadPermission(input.scopeKind);
  if (!granted.has(requiredRead)) {
    throw new Error(`OMI Agents do not have the required permission: ${requiredRead}.`);
  }
  if (!granted.has('document.suggest')) {
    throw new Error('OMI Agents do not have permission to create manuscript suggestions.');
  }

  for (const permission of input.requestedPermissions) {
    const normalized = permission === 'suggest' ? 'document.suggest' : permission;
    if (!VALID_PERMISSIONS.has(normalized as OmiAgentPermission)) {
      throw new Error(`Unsupported OMI agent permission: ${permission}.`);
    }
    if (!granted.has(normalized as OmiAgentPermission)) {
      throw new Error(`OMI Agents were not granted permission: ${normalized}.`);
    }
  }

  const directWriteRequested = input.requestedPermissions.some(
    (permission) => permission === 'document.write' || permission === 'metadata.write',
  );
  if (directWriteRequested && state.config.reviewRequired) {
    throw new Error('Direct writes are disabled while “review every suggestion” is enabled.');
  }
  if (directWriteRequested && input.allowDirectWrite !== true) {
    throw new Error('Direct writes require explicit confirmation for this run.');
  }

  return state.config;
}
