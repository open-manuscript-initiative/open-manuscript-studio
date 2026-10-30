/**
 * Parse the Studio session cookie without letting untrusted/invalid percent
 * escapes throw URIError from security-critical route handlers.
 *
 * Session cookies are opaque, and the original token is only ever used for
 * lookup by its SHA-256 hash. No cookies other than omi_session are accepted.
 */
export function readOmiSessionCookie(header: string | undefined): string | undefined {
  if (!header) return undefined;
  for (const fragment of header.split(';')) {
    const separator = fragment.indexOf('=');
    if (separator < 0) continue;
    const name = fragment.slice(0, separator).trim();
    if (name !== 'omi_session') continue;
    const value = fragment.slice(separator + 1).trim();
    // Avoid needless hashing and DB lookup of excessively long opaque input.
    if (!value || value.length > 512) return undefined;
    try {
      const decoded = decodeURIComponent(value);
      return decoded && decoded.length <= 512 ? decoded : undefined;
    } catch {
      return undefined;
    }
  }
  return undefined;
}
