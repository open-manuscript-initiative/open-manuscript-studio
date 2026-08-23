import type { StudioPlatform } from '../mobile/platform/platform';

export type CloudStorageProviderId =
  | 'local-folder'
  | 'nextcloud'
  | 'webdav'
  | 'onedrive'
  | 'sharepoint'
  | 'google-drive'
  | 'dropbox'
  | 'proton-drive'
  | 'icloud-drive';

// local-folder is retained only for compatibility with older device-local
// preferences. New UI flows expose native system storage globally instead of
// pretending it is a provider-specific connection method.
export type CloudConnectionMethodId =
  | 'local-folder'
  | 'webdav'
  | 'oauth2'
  | 'proton-sdk';
export type CloudAccountType = 'personal' | 'business';

export type CloudConnectionImplementation =
  | 'local-folder'
  | 'webdav'
  | 'oauth2'
  | 'planned-oauth'
  | 'planned-proton-sdk';

export type CloudAuthenticationKind =
  | 'none'
  | 'webdav-credentials'
  | 'oauth2'
  | 'proton-session';

export interface CloudStorageProviderDescriptor {
  id: CloudStorageProviderId;
  displayName: string;
  accountTypes: CloudAccountType[];
  /** Whether the provider commonly appears through an OS sync/file provider. */
  supportsLocalFolder: boolean;
  supportsWebDav: boolean;
  supportsOAuth: boolean;
  supportsProtonSdk?: boolean;
  directProviderType: 'nextcloud' | 'webdav' | null;
}

export interface CloudConnectionMethodDescriptor {
  id: CloudConnectionMethodId;
  implementation: CloudConnectionImplementation;
  authentication: CloudAuthenticationKind;
  available: boolean;
  recommended: boolean;
}

/**
 * Real cloud services that may receive a direct Studio-managed connection.
 *
 * Native system storage is deliberately outside this list. Installed Studio
 * builds always use the operating system picker for local, synchronized,
 * network and document-provider storage without requiring a provider account
 * to be configured in Studio first.
 */
export const cloudStorageProviders: CloudStorageProviderDescriptor[] = [
  {
    id: 'nextcloud',
    displayName: 'Nextcloud',
    accountTypes: ['personal', 'business'],
    supportsLocalFolder: true,
    supportsWebDav: true,
    supportsOAuth: true,
    directProviderType: 'nextcloud',
  },
  {
    id: 'webdav',
    displayName: 'WebDAV',
    accountTypes: ['personal', 'business'],
    supportsLocalFolder: false,
    supportsWebDav: true,
    supportsOAuth: false,
    directProviderType: 'webdav',
  },
  {
    id: 'onedrive',
    displayName: 'Microsoft OneDrive',
    accountTypes: ['personal', 'business'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: true,
    directProviderType: null,
  },
  {
    id: 'sharepoint',
    displayName: 'Microsoft SharePoint',
    accountTypes: ['business'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: true,
    directProviderType: null,
  },
  {
    id: 'google-drive',
    displayName: 'Google Drive',
    accountTypes: ['personal', 'business'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: true,
    directProviderType: null,
  },
  {
    id: 'dropbox',
    displayName: 'Dropbox',
    accountTypes: ['personal', 'business'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: true,
    directProviderType: null,
  },
  {
    id: 'proton-drive',
    displayName: 'Proton Drive',
    accountTypes: ['personal', 'business'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: false,
    supportsProtonSdk: true,
    directProviderType: null,
  },
  {
    id: 'icloud-drive',
    displayName: 'iCloud Drive',
    accountTypes: ['personal'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: false,
    directProviderType: null,
  },
];

// Kept only so old local preference identifiers remain understandable to
// compatibility code. It is never exposed in the current provider picker.
const legacyLocalFolderProvider: CloudStorageProviderDescriptor = {
  id: 'local-folder',
  displayName: 'Local / synchronized folder',
  accountTypes: ['personal'],
  supportsLocalFolder: true,
  supportsWebDav: false,
  supportsOAuth: false,
  directProviderType: null,
};

export function getCloudStorageProvider(
  providerId: CloudStorageProviderId,
): CloudStorageProviderDescriptor {
  if (providerId === 'local-folder') return legacyLocalFolderProvider;
  const provider = cloudStorageProviders.find((entry) => entry.id === providerId);
  if (!provider) {
    throw new Error(`Unsupported cloud storage provider: ${providerId}`);
  }
  return provider;
}

export function getCloudConnectionMethods(
  providerId: CloudStorageProviderId,
  accountType: CloudAccountType,
  _platform: StudioPlatform,
): CloudConnectionMethodDescriptor[] {
  const provider = getCloudStorageProvider(providerId);
  if (!provider.accountTypes.includes(accountType)) return [];

  const methods: CloudConnectionMethodDescriptor[] = [];

  // The system picker is globally available in native builds and therefore is
  // not repeated as a provider-specific method here. These are only direct
  // Studio-managed cloud connections.
  if (provider.supportsWebDav) {
    methods.push({
      id: 'webdav',
      implementation: 'webdav',
      authentication: 'webdav-credentials',
      available: true,
      recommended: true,
    });
  }

  if (provider.supportsOAuth) {
    const productionOAuth = provider.id === 'google-drive'
      || provider.id === 'onedrive'
      || provider.id === 'dropbox';
    methods.push({
      id: 'oauth2',
      implementation: productionOAuth ? 'oauth2' : 'planned-oauth',
      authentication: 'oauth2',
      available: productionOAuth,
      recommended: productionOAuth && !provider.supportsWebDav,
    });
  }

  if (provider.supportsProtonSdk) {
    methods.push({
      id: 'proton-sdk',
      implementation: 'planned-proton-sdk',
      authentication: 'proton-session',
      available: false,
      recommended: false,
    });
  }

  return methods;
}

export function getDefaultCloudConnectionMethod(
  providerId: CloudStorageProviderId,
  accountType: CloudAccountType,
  platform: StudioPlatform,
): CloudConnectionMethodId | null {
  const methods = getCloudConnectionMethods(providerId, accountType, platform);
  return methods.find((method) => method.recommended && method.available)?.id
    ?? methods.find((method) => method.available)?.id
    ?? methods.find((method) => method.id === 'oauth2')?.id
    ?? methods[0]?.id
    ?? null;
}
