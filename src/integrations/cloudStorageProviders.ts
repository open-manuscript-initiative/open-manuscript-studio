import type { StudioPlatform } from '../mobile/platform/platform';

export type CloudStorageProviderId =
  | 'local-folder'
  | 'nextcloud'
  | 'webdav'
  | 'onedrive'
  | 'sharepoint'
  | 'google-drive'
  | 'dropbox'
  | 'icloud-drive';

export type CloudAccountType = 'personal' | 'business';
export type CloudConnectionMethodId = 'local-folder' | 'webdav' | 'oauth2';

export type CloudConnectionImplementation =
  | 'local-folder'
  | 'webdav'
  | 'planned-oauth';

export type CloudAuthenticationKind =
  | 'none'
  | 'webdav-credentials'
  | 'oauth2';

export interface CloudStorageProviderDescriptor {
  id: CloudStorageProviderId;
  displayName: string;
  accountTypes: CloudAccountType[];
  supportsLocalFolder: boolean;
  supportsWebDav: boolean;
  supportsOAuth: boolean;
  directProviderType: 'nextcloud' | 'webdav' | null;
}

export interface CloudConnectionMethodDescriptor {
  id: CloudConnectionMethodId;
  implementation: CloudConnectionImplementation;
  authentication: CloudAuthenticationKind;
  available: boolean;
  recommended: boolean;
}

export const cloudStorageProviders: CloudStorageProviderDescriptor[] = [
  {
    id: 'local-folder',
    displayName: 'Local / synchronized folder',
    accountTypes: ['personal'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: false,
    directProviderType: null,
  },
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
    id: 'icloud-drive',
    displayName: 'iCloud Drive',
    accountTypes: ['personal'],
    supportsLocalFolder: true,
    supportsWebDav: false,
    supportsOAuth: false,
    directProviderType: null,
  },
];

export function getCloudStorageProvider(
  providerId: CloudStorageProviderId,
): CloudStorageProviderDescriptor {
  const provider = cloudStorageProviders.find((entry) => entry.id === providerId);
  if (!provider) {
    throw new Error(`Unsupported cloud storage provider: ${providerId}`);
  }
  return provider;
}

export function getCloudConnectionMethods(
  providerId: CloudStorageProviderId,
  accountType: CloudAccountType,
  platform: StudioPlatform,
): CloudConnectionMethodDescriptor[] {
  const provider = getCloudStorageProvider(providerId);
  if (!provider.accountTypes.includes(accountType)) return [];

  const methods: CloudConnectionMethodDescriptor[] = [];
  const desktop = platform === 'desktop';

  if (provider.supportsLocalFolder) {
    methods.push({
      id: 'local-folder',
      implementation: 'local-folder',
      authentication: 'none',
      available: desktop,
      recommended: desktop,
    });
  }

  if (provider.supportsWebDav) {
    methods.push({
      id: 'webdav',
      implementation: 'webdav',
      authentication: 'webdav-credentials',
      available: true,
      recommended: !desktop || !provider.supportsLocalFolder,
    });
  }

  if (provider.supportsOAuth) {
    methods.push({
      id: 'oauth2',
      implementation: 'planned-oauth',
      authentication: 'oauth2',
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
  const available = methods.find((method) => method.recommended && method.available)?.id
    ?? methods.find((method) => method.available)?.id;
  if (available) return available;

  if (platform !== 'desktop') {
    const oauth = methods.find((method) => method.id === 'oauth2');
    if (oauth) return oauth.id;
  }

  return methods[0]?.id ?? null;
}
