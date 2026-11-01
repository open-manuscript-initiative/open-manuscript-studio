import { readFileSync } from 'node:fs';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

/**
 * Generate an OPTIONAL, separately reviewed nftables egress policy for one
 * dedicated Studio API UID. This module never executes nft, iptables,
 * systemctl, sudo, DNS or network connections.
 *
 * A host administrator must inventory the actual API UID, internal DB/DNS
 * sockets and approved public destinations before generating/applying it.
 * No Plesk-wide firewall, inherited rules or SSH management rules are edited.
 */
export const TABLE_NAME = 'omi_studio_api_egress';
export const RESERVED_V4 = Object.freeze([
  '0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
  '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24',
  '192.0.2.0/24', '192.88.99.0/24', '192.168.0.0/16',
  '198.18.0.0/15', '198.51.100.0/24', '203.0.113.0/24',
  '224.0.0.0/4', '240.0.0.0/4',
]);
export const RESERVED_V6 = Object.freeze([
  '::/128', '::1/128', '::ffff:0:0/96', '64:ff9b::/96',
  '100::/64', '2001::/32', '2001:db8::/32', '2002::/16',
  '3fff::/20', 'fc00::/7', 'fe80::/10', 'ff00::/8',
]);

function isPlainObject(value) {
  return !!value && typeof value === 'object' &&
    !Array.isArray(value) && Object.getPrototypeOf(value) === Object.prototype;
}
function validAddressOrCidr(raw, family) {
  if (typeof raw !== 'string' || raw.length > 70 || raw.trim() !== raw) return false;
  const match = /^([^/]+)(?:\/(\d{1,3}))?$/.exec(raw);
  if (!match || isIP(match[1]) !== family) return false;
  const prefix = match[2] === undefined ? (family === 4 ? 32 : 128) : Number(match[2]);
  return prefix >= 0 && prefix <= (family === 4 ? 32 : 128);
}
function endpoint(entry) {
  if (!isPlainObject(entry)) throw new Error('Endpoint must be an object');
  const { address, protocol, port } = entry;
  if (typeof address !== 'string' ||
      (isIP(address) !== 4 && isIP(address) !== 6) ||
      !['tcp', 'udp'].includes(protocol) ||
      !Number.isSafeInteger(port) || port < 1 || port > 65535) {
    throw new Error('An endpoint requires one IP literal, tcp/udp and port 1–65535');
  }
  // Only a precise IP literal, never a CIDR/wildcard/hostname, may have a
  // local exception. Local exceptions must be explicitly operator-reviewed.
  return { address, protocol, port, family: isIP(address) };
}

export function validatePolicy(profile) {
  if (!isPlainObject(profile) || profile.schemaVersion !== 1) {
    throw new Error('Expected a versioned egress profile (schemaVersion: 1)');
  }
  const { uid, service, localExceptions, outbound } = profile;
  if (!Number.isSafeInteger(uid) || uid < 100 || uid > 0x7fffffff) {
    throw new Error('Dedicated API numeric UID required (root, system and placeholder UIDs refused)');
  }
  if (service !== 'omi-studio-api.service') {
    throw new Error('This policy is scoped only to omi-studio-api.service');
  }
  if (!Array.isArray(localExceptions) || localExceptions.length > 20 ||
      !Array.isArray(outbound) || outbound.length < 1 || outbound.length > 200) {
    throw new Error('Explicit local exceptions and at least one approved public destination are required');
  }
  const locals = localExceptions.map(endpoint);
  if (locals.some(item => !(
    (item.family === 4 && (item.address.startsWith('127.') ||
      item.address.startsWith('10.') ||
      item.address.startsWith('192.168.') ||
      (item.address.startsWith('172.') &&
       Number(item.address.split('.')[1]) >= 16 &&
       Number(item.address.split('.')[1]) <= 31) ||
      item.address.startsWith('169.254.'))) ||
    (item.family === 6 && (item.address === '::1' || /^f[cd]/i.test(item.address)))
  ))) {
    throw new Error('Local exceptions must be loopback or explicitly private service IP literals');
  }
  if (locals.some(item => item.port === 80 || item.port === 443)) {
    throw new Error('No general local HTTP(S) exemption: use audited AF_UNIX or an isolated broker');
  }

  const publicTargets = outbound.map(item => {
    if (!isPlainObject(item) || !['tcp', 'udp'].includes(item.protocol) ||
        !Number.isSafeInteger(item.port) || item.port < 1 || item.port > 65535 ||
        typeof item.cidr !== 'string') {
      throw new Error('Public outbound entry requires explicit CIDR, protocol and port');
    }
    const family = isIP(item.cidr.split('/')[0]);
    if (!family || !validAddressOrCidr(item.cidr, family)) {
      throw new Error('Malformed approved public CIDR');
    }
    const prefix = Number(item.cidr.split('/')[1] ?? (family === 4 ? '32' : '128'));
    if (prefix < (family === 4 ? 16 : 32)) {
      throw new Error('Approved public range too broad for per-destination egress review');
    }
    if (!isStrictPublicCidr(item.cidr, family)) {
      throw new Error('Approved public destination overlaps nonpublic or transitional range: ' + item.cidr);
    }
    return { ...item, family };
  });
  const localKeys = locals.map(item => [item.address, item.protocol, item.port].join(':'));
  const publicKeys = publicTargets.map(item => [item.cidr, item.protocol, item.port].join(':'));
  if (new Set(localKeys).size !== localKeys.length ||
      new Set(publicKeys).size !== publicKeys.length) {
    throw new Error('Duplicate exceptions require review');
  }
  return { uid, service, locals, publicTargets };
}

// This check is intentionally conservative; it rejects address ranges whose
// complete CIDR can touch any nonpublic space, including IPv4-mapped IPv6 and
// 6to4/Teredo. The nftables default for all unapproved traffic remains reject.
export function isStrictPublicCidr(cidr, family) {
  if (!validAddressOrCidr(cidr, family)) return false;
  const [address, maskText] = cidr.split('/');
  const prefix = Number(maskText ?? (family === 4 ? 32 : 128));
  if (family === 4) {
    const ip = address.split('.').reduce((n, part) => ((n << 8) | Number(part)) >>> 0, 0);
    const shift = (32 - prefix);
    const mask = shift === 32 ? 0 : (0xffffffff << shift) >>> 0;
    const start = (ip & mask) >>> 0;
    const end = (start | (~mask >>> 0)) >>> 0;
    // Require no overlap with reserved/private ranges, even when the
    // operator mistakenly enters a prefix broader than one public host.
    const parseV4 = str => str.split('.').reduce((n, part) => ((n << 8) | Number(part)) >>> 0, 0);
    return RESERVED_V4.every(net => {
      const [base, length] = net.split('/');
      const n = Number(length);
      const networkMask = (0xffffffff << (32 - n)) >>> 0;
      const lower = parseV4(base) & networkMask;
      const upper = (lower | (~networkMask >>> 0)) >>> 0;
      return end < lower || start > upper;
    });
  }
  // Explicitly allow only normal global unicast 2000::/3. Reject important
  // embedded/reserved transition subnets via the reserved ranges below.
  const number = ipv6ToBigInt(address);
  if (number === null) return false;
  const bitMask = ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - prefix)) - 1n);
  const start = number & bitMask;
  const end = start | (~bitMask & ((1n << 128n) - 1n));
  const globalStart = 0x2000n << 112n;
  const globalEnd = ((0x3fffn << 112n) | ((1n << 112n) - 1n));
  if (start < globalStart || end > globalEnd) return false;
  return RESERVED_V6.every(net => {
    const [base, length] = net.split('/');
    const network = ipv6ToBigInt(base);
    if (network === null) return false;
    const blockMask = ((1n << 128n) - 1n) ^ ((1n << BigInt(128 - Number(length))) - 1n);
    const lower = network & blockMask;
    const upper = lower | (~blockMask & ((1n << 128n) - 1n));
    return end < lower || start > upper;
  });
}
function ipv6ToBigInt(raw) {
  if (isIP(raw) !== 6 || raw.includes('.')) return null;
  const sections = raw.toLowerCase().split('::');
  if (sections.length > 2) return null;
  const left = sections[0] ? sections[0].split(':') : [];
  const right = sections[1] ? sections[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if (missing < 0 || (sections.length === 1 && missing !== 0)) return null;
  const full = [...left, ...Array(missing).fill('0'), ...right];
  if (full.length !== 8) return null;
  return full.reduce((n, chunk) => (n << 16n) + BigInt(parseInt(chunk, 16)), 0n);
}

export function renderPolicy(profile) {
  const { uid, locals, publicTargets } = validatePolicy(profile);
  const lines = [
    '# OMI issue #765: candidate, generated OFFLINE; not installed or live-verified.',
    '# Dedicated UID: ' + uid + '. This must be the actual API service UID and exclusive to the API.',
    '# SSH/Plesk, host/global input, Docker FORWARD and other services are untouched.',
    '# Apply only after root preflight, backup, nft -c validation and rollback rehearsal.',
    'table inet ' + TABLE_NAME + ' {',
    '  chain output {',
    '    type filter hook output priority -50; policy accept;',
    '    meta skuid ' + uid + ' ct state { established, related } accept',
  ];
  for (const item of locals) {
    lines.push('    meta skuid ' + uid + ' ' +
      (item.family === 4 ? 'ip' : 'ip6') + ' daddr ' + item.address +
      ' ' + item.protocol + ' dport ' + item.port +
      ' counter accept comment "omi-explicit-local-service"');
  }
  // All private, local and transition routes are rejected regardless of
  // external CIDR mistakes. Local exceptions above are deliberately narrow.
  lines.push('    meta skuid ' + uid +
    ' ip daddr { ' + RESERVED_V4.join(', ') +
    ' } counter reject comment "omi-nonpublic-v4"');
  lines.push('    meta skuid ' + uid +
    ' ip6 daddr { ' + RESERVED_V6.join(', ') +
    ' } counter reject comment "omi-nonpublic-v6"');
  for (const item of publicTargets) {
    lines.push('    meta skuid ' + uid + ' ' +
      (item.family === 4 ? 'ip' : 'ip6') + ' daddr ' + item.cidr +
      ' ' + item.protocol + ' dport ' + item.port +
      ' counter accept comment "omi-approved-public-egress"');
  }
  lines.push('    meta skuid ' + uid +
    ' counter reject comment "omi-unapproved-egress"');
  lines.push('  }', '}', '');
  return lines.join('\n');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== '--profile') {
    console.error('Usage: node scripts/egress/generate-policy.mjs --profile /root/private-api-profile.json');
    process.exitCode = 2;
  } else {
    try {
      // Printed stdout is a DRY-RUN file, never automatically installed.
      process.stdout.write(renderPolicy(JSON.parse(readFileSync(resolve(args[1]), 'utf8'))));
    } catch (error) {
      console.error(error instanceof Error ? error.message : 'Invalid egress profile');
      process.exitCode = 1;
    }
  }
}
