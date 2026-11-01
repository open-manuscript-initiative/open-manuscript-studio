import { isIP } from 'node:net';

/**
 * Fail closed for non-public address ranges, including IPv4-mapped IPv6,
 * carrier-grade NAT, benchmark and documentation networks.
 *
 * A DNS check is only a first line of defence. Operators must also block
 * egress to private and metadata networks to prevent DNS-rebinding attacks.
 */
export function isPublicRoutableAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const octets = address.split('.').map(Number);
    const [a, b, c] = octets;
    if (a === undefined || b === undefined || c === undefined) return false;
    return !(
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 0 && c === 0) || // 192.0.0.0/24 IETF protocol assignments
      (a === 192 && b === 0 && c === 2) // TEST-NET-1 ||
      (a === 192 && b === 88 && c === 99) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
      (a === 203 && b === 0 && c === 113) ||
      a >= 224
    );
  }

  if (version === 6) {
    // Only global unicast 2000::/3 is eligible. This also rejects IPv4-mapped
    // (::ffff:127.0.0.1), link-local, unique-local, multicast and NAT64
    // well-known-prefix addresses.
    const parts = address.toLowerCase().split(':');
    const first = Number.parseInt(parts[0] ?? '', 16);
    if (!Number.isFinite(first) || (first & 0xe000) !== 0x2000) return false;
    const second = parts[1] === '' ? 0 : Number.parseInt(parts[1] ?? '', 16);
    if (
      first === 0x2002 || // 6to4 encapsulation
      first === 0x3fff || // documentation prefix
      (first === 0x2001 && (second === 0 || second === 0x0db8))
    ) return false;
    return true;
  }

  return false;
}
