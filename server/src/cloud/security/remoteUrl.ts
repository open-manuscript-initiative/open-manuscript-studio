import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

import { env } from '../../config/env.js';
import { CloudStorageError } from '../errors/CloudStorageError.js';

function isPrivateIpv4(address: string): boolean {
  const octets = address.split('.').map(Number);
  if (octets.length !== 4 || octets.some((value) => !Number.isInteger(value))) {
    return true;
  }

  const a = octets[0];
  const b = octets[1];
  if (a === undefined || b === undefined) return true;

  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224
  );
}

function isPrivateIpv6(address: string): boolean {
  const normalized = address.toLowerCase();
  return (
    normalized === '::' ||
    normalized === '::1' ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd') ||
    normalized.startsWith('fe8') ||
    normalized.startsWith('fe9') ||
    normalized.startsWith('fea') ||
    normalized.startsWith('feb')
  );
}

function isPrivateAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) return isPrivateIpv4(address);
  if (version === 6) return isPrivateIpv6(address);
  return true;
}

export async function assertSafeRemoteUrl(rawUrl: string): Promise<URL> {
  let url: URL;

  try {
    url = new URL(rawUrl);
  } catch (error) {
    throw new CloudStorageError(
      'CLOUD_UNSAFE_REMOTE_URL',
      'The WebDAV server URL is invalid.',
      error,
    );
  }

  if (url.username || url.password) {
    throw new CloudStorageError(
      'CLOUD_UNSAFE_REMOTE_URL',
      'Credentials must not be embedded in the WebDAV server URL.',
    );
  }

  const developmentLocalhost =
    env.NODE_ENV !== 'production' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '::1');

  if (url.protocol !== 'https:' && !(developmentLocalhost && url.protocol === 'http:')) {
    throw new CloudStorageError(
      'CLOUD_UNSAFE_REMOTE_URL',
      'WebDAV connections must use HTTPS.',
    );
  }

  if (developmentLocalhost) return url;

  const addresses = await lookup(url.hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new CloudStorageError(
      'CLOUD_UNSAFE_REMOTE_URL',
      'The WebDAV server resolves to a private or reserved network address.',
    );
  }

  return url;
}
