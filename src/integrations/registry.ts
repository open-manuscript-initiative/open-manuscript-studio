import type {
  IntegrationPermission,
  IntegrationProviderDescriptor,
  IntegrationProviderKind,
} from './contracts';

export interface IntegrationCatalogEntry extends IntegrationProviderDescriptor {
  categoryLabel: string;
  status: 'available' | 'planned' | 'connected';
  configurable?: boolean;
}

const permissions = (...items: IntegrationPermission[]) => items;

export const integrationCatalog: IntegrationCatalogEntry[] = [
  {
    id: 'deepl',
    kind: 'translation',
    displayName: 'DeepL',
    description: 'Machine translation provider for selections, blocks, sections, and manuscript language variants.',
    categoryLabel: 'Translation',
    permissions: permissions('document.read', 'document.suggest'),
    requiresServerSecret: true,
    configurable: true,
    status: 'available',
  },
  {
    id: 'ai-provider',
    kind: 'ai',
    displayName: 'AI provider',
    description: 'Provider-neutral AI endpoint for language editing, summarisation, metadata and citation assistance.',
    categoryLabel: 'AI',
    permissions: permissions('document.read', 'document.suggest', 'metadata.read'),
    requiresServerSecret: true,
    configurable: true,
    status: 'planned',
  },
  {
    id: 'omi-agents',
    kind: 'agent',
    displayName: 'OMI agents',
    description: 'Scoped assistants for language editing, metadata generation, summarisation and citation checks.',
    categoryLabel: 'AI agents',
    permissions: permissions('document.read', 'document.suggest', 'metadata.read'),
    requiresServerSecret: false,
    status: 'planned',
  },
  {
    id: 'ojs-omp',
    kind: 'publishing',
    displayName: 'OJS / OMP',
    description: 'Publishing-system integration for manuscript exchange, assignments and editorial workflow.',
    categoryLabel: 'Publishing',
    permissions: permissions('document.read', 'document.write', 'metadata.read', 'metadata.write', 'files.read', 'files.write'),
    requiresServerSecret: false,
    status: 'connected',
  },
  {
    id: 'orcid',
    kind: 'identity',
    displayName: 'ORCID',
    description: 'Researcher identity and profile linking using ORCID authentication and identifiers.',
    categoryLabel: 'Identity',
    permissions: permissions('metadata.read', 'metadata.write'),
    requiresServerSecret: true,
    configurable: true,
    status: 'planned',
  },
  {
    id: 'cloud-storage',
    kind: 'storage',
    displayName: 'Cloud storage',
    description: 'Pluggable storage providers for synchronized manuscript files and backups.',
    categoryLabel: 'Storage',
    permissions: permissions('files.read', 'files.write'),
    requiresServerSecret: true,
    configurable: true,
    status: 'planned',
  },
];

export function getIntegrationsByKind(kind: IntegrationProviderKind): IntegrationCatalogEntry[] {
  return integrationCatalog.filter((entry) => entry.kind === kind);
}
