import { lookup } from 'node:dns/promises';
import { env } from '../../config/env.js';
import { CloudStorageError } from '../errors/CloudStorageError.js';
import { isPublicRoutableAddress } from './publicAddress.js';

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
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicRoutableAddress(address))) {
    throw new CloudStorageError(
      'CLOUD_UNSAFE_REMOTE_URL',
      'The WebDAV server resolves to a private or reserved network address.',
    );
  }

  return url;
}
