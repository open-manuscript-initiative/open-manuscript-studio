import {
  decryptSecret,
  encryptSecret,
  type EncryptedSecret,
} from '../integrations/secretCrypto.js';
import { prisma } from '../lib/prisma.js';
import type { CloudStorageProvider } from './CloudStorageProvider.js';
import { OAuthCloudProvider } from './providers/oauth/OAuthCloudProvider.js';
import { WebDavProvider } from './providers/webdav/WebDavProvider.js';
import type {
  CloudProviderType,
  OAuthCloudCredentials,
  WebDavCredentials,
} from './types.js';

export interface StoredCloudConnection {
  id?: string;
  providerType: string;
  encryptedCredentials: string;
}

function parseEncryptedSecret(serialized: string): EncryptedSecret {
  const value = JSON.parse(serialized) as Partial<EncryptedSecret>;
  if (!value.ciphertext || !value.iv || !value.authTag) {
    throw new Error('Stored cloud credentials are invalid.');
  }

  return {
    ciphertext: value.ciphertext,
    iv: value.iv,
    authTag: value.authTag,
  };
}

function parseWebDavCredentials(serialized: string): WebDavCredentials {
  const value = JSON.parse(serialized) as Partial<WebDavCredentials>;
  if (!value.baseUrl || !value.username || !value.password || value.rootPath === undefined) {
    throw new Error('Stored WebDAV credentials are invalid.');
  }

  return {
    baseUrl: value.baseUrl,
    username: value.username,
    password: value.password,
    rootPath: value.rootPath,
  };
}

function parseOAuthCredentials(serialized: string, type: CloudProviderType): OAuthCloudCredentials {
  const value = JSON.parse(serialized) as Partial<OAuthCloudCredentials>;
  if (
    (type !== 'google-drive' && type !== 'onedrive' && type !== 'dropbox') ||
    value.provider !== type ||
    !value.accessToken ||
    value.rootPath === undefined
  ) {
    throw new Error('Stored OAuth cloud credentials are invalid.');
  }
  return {
    provider: type,
    accessToken: value.accessToken,
    ...(value.refreshToken ? { refreshToken: value.refreshToken } : {}),
    ...(value.expiresAt ? { expiresAt: value.expiresAt } : {}),
    ...(value.scope ? { scope: value.scope } : {}),
    rootPath: value.rootPath,
  };
}

export function providerTypeFromDatabase(value: string): CloudProviderType {
  if (value === 'WEBDAV') return 'webdav';
  if (value === 'NEXTCLOUD') return 'nextcloud';
  if (value === 'GOOGLE_DRIVE') return 'google-drive';
  if (value === 'ONEDRIVE') return 'onedrive';
  if (value === 'DROPBOX') return 'dropbox';
  throw new Error(`Unsupported cloud provider type: ${value}`);
}

export function createCloudProvider(
  connection: StoredCloudConnection,
): CloudStorageProvider {
  const type = providerTypeFromDatabase(connection.providerType);
  const secret = parseEncryptedSecret(connection.encryptedCredentials);
  const decrypted = decryptSecret(secret);

  if (type === 'webdav' || type === 'nextcloud') {
    return new WebDavProvider(parseWebDavCredentials(decrypted), type);
  }

  const credentials = parseOAuthCredentials(decrypted, type);
  return new OAuthCloudProvider(
    credentials,
    connection.id
      ? async (updated) => {
          const encrypted = encryptSecret(JSON.stringify(updated));
          await prisma.cloudConnection.update({
            where: { id: connection.id! },
            data: {
              encryptedCredentials: JSON.stringify(encrypted),
              lastVerifiedAt: new Date(),
            },
          });
        }
      : undefined,
  );
}
