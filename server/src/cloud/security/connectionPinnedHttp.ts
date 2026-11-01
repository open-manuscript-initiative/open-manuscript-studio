import { lookup as dnsLookup } from 'node:dns/promises';
import type { LookupAddress, LookupOptions } from 'node:dns';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable } from 'node:stream';
import { isIP } from 'node:net';
import { isPublicRoutableAddress } from './publicAddress.js';

type ResolveAll = (hostname: string, options: { all: true; verbatim: true }) => Promise<LookupAddress[]>;
type PinnedLookup = (
  hostname: string,
  options: LookupOptions,
  callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
) => void;

const defaultResolve: ResolveAll = (hostname, options) => dnsLookup(hostname, options);

function isDevelopmentLoopback(url: URL): boolean {
  return process.env.NODE_ENV !== 'production' &&
    (url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]');
}

function isExplicitIntegrationTestHost(url: URL): boolean {
  if (process.env.NODE_ENV !== 'test') return false;
  return (process.env.INTEGRATION_TEST_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .includes(url.hostname.toLowerCase());
}

/**
 * The OS socket's lookup callback is the policy enforcement point: the
 * verified address list is returned directly to net.connect. There is no
 * separate preflight DNS check followed by a second unrestricted lookup.
 *
 * Reject an entire DNS answer if ANY A/AAAA answer is private/reserved.
 * No global DNS or HTTP agent state is modified.
 */
export function connectionTimePublicLookup(
  url: URL,
  resolveAll: ResolveAll = defaultResolve,
): PinnedLookup {
  const allowLocal = isDevelopmentLoopback(url) || isExplicitIntegrationTestHost(url);
  return ((
    hostname: string,
    options: LookupOptions,
    callback: (error: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void,
  ) => {
    if (hostname.toLowerCase() !== url.hostname.toLowerCase()) {
      callback(new Error('Outbound hostname differs from validated endpoint.'), '', 0);
      return;
    }
    void resolveAll(hostname, { all: true, verbatim: true }).then((answers) => {
      if (!answers.length || answers.some(({ address }) =>
        !isIP(address) || (!allowLocal && !isPublicRoutableAddress(address))
      )) {
        callback(new Error('Outbound endpoint resolves to a private or reserved address.'), '', 0);
        return;
      }
      const family = options.family ?? 0;
      const candidates = family === 4 || family === 6
        ? answers.filter((answer) => answer.family === family)
        : answers;
      if (!candidates.length) {
        callback(new Error('No verified address for requested IP family.'), '', 0);
        return;
      }
      if (options.all) {
        callback(null, candidates);
      } else {
        const selected = candidates[0]!;
        callback(null, selected.address, selected.family);
      }
    }).catch((error: unknown) => {
      callback(error instanceof Error ? error : new Error('DNS lookup failed.'), '', 0);
    });
  }) as PinnedLookup;
}

export interface PinnedRemoteRequest {
  method: string;
  headers?: Record<string, string>;
  body?: Buffer | string;
}

/**
 * WebDAV uses the original HTTPS hostname for Host/SNI/certificate checking,
 * but its socket connects only to the public addresses validated in the same
 * lookup call. No redirects, HTTP proxy or connection sharing is permitted.
 */
export async function requestPinnedPublicUrl(
  target: URL,
  input: PinnedRemoteRequest,
): Promise<Response> {
  const local = isDevelopmentLoopback(target) || isExplicitIntegrationTestHost(target);
  if (target.username || target.password || (target.protocol !== 'https:' && !(local && target.protocol === 'http:'))) {
    throw new Error('Outbound endpoint must use HTTPS without embedded credentials.');
  }
  // Literal IP addresses bypass the OS DNS callback: check before creating
  // any socket, including IPv4-mapped IPv6 and local test exceptions.
  const ipHost = target.hostname.startsWith('[') ? target.hostname.slice(1, -1) : target.hostname;
  if (isIP(ipHost) && !local && !isPublicRoutableAddress(ipHost)) {
    throw new Error('Outbound endpoint uses a private or reserved IP address.');
  }

  return new Promise<Response>((resolve, reject) => {
    const request = (target.protocol === 'https:' ? httpsRequest : httpRequest)(target, {
      method: input.method,
      headers: input.headers,
      agent: false,
      lookup: connectionTimePublicLookup(target),
      timeout: 120_000,
    }, (response) => {
      const status = response.statusCode ?? 0;
      // Keep non-success WebDAV status codes observable, including 3xx;
      // redirects are never followed by this transport.
      if (status < 200 || status > 599) {
        response.destroy();
        reject(new Error('Invalid outbound HTTP status.'));
        return;
      }
      const headers = new Headers();
      for (const [name, value] of Object.entries(response.headers)) {
        if (Array.isArray(value)) {
          for (const item of value) headers.append(name, item);
        } else if (value !== undefined) {
          headers.set(name, value);
        }
      }
      const body = status === 204 || status === 205 || status === 304
        ? null
        : (Readable.toWeb(response) as unknown as ReadableStream);
      resolve(new Response(body, { status, headers }));
    });
    request.on('error', reject);
    request.on('timeout', () => request.destroy(new Error('Outbound request timed out.')));
    if (input.body !== undefined) request.end(input.body);
    else request.end();
  });
}
