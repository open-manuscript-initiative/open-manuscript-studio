import { decryptSecret, type EncryptedSecret } from '../integrations/secretCrypto.js';
import type { CloudStorageProvider } from './CloudStorageProvider.js';
import { WebDavProvider } from './providers/webdav/WebDavProvider.js';
import type { CloudProviderType, WebDavCredentials } from './types.js';

export interface StoredCloudConnection {
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

function parseCredentials(serialized: string): WebDavCredentials {
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

export function providerTypeFromDatabase(value: string): CloudProviderType {
  if (value === 'WEBDAV') return 'webdav';
  if (value === 'NEXTCLOUD') return 'nextcloud';
  throw new Error(`Unsupported cloud provider type: ${value}`);
}

export function createCloudProvider(
  connection: StoredCloudConnection,
): CloudStorageProvider {
  const type = providerTypeFromDatabase(connection.providerType);
  const secret = parseEncryptedSecret(connection.encryptedCredentials);
  const credentials = parseCredentials(decryptSecret(secret));

  return new WebDavProvider(credentials, type);
}
