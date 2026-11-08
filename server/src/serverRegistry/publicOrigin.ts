import {isIP} from 'node:net';

export function normalizePublicOrigin(value: string): { origin: string; hostname: string } {
  const url = new URL(value);
  const hostname = url.hostname.toLowerCase().replace(/\.$/, '');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' ||
      url.search || url.hash || isIP(hostname.replace(/^\[|\]$/g, '')) !== 0 ||
      !hostname.includes('.') || hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) {
    throw new Error('Server origins must be public HTTPS origins without a path.');
  }
  return {origin: url.origin, hostname};
}
