import type { NextFunction, Request, Response } from 'express';

const UNSAFE_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * A browser can send SameSite cookies from another subdomain of the same
 * registrable domain. CORS alone does not reject cross-origin HTML forms.
 *
 * Protect cookie-authenticated state changes before parsing request bodies.
 * Native clients authenticate via an explicit bearer token; machine-to-machine
 * integration requests do not carry the Studio browser session cookie.
 */
export function rejectsCookieOrigin(input: {
  method: string;
  cookie?: string | undefined;
  origin?: string | undefined;
  authorization?: string | undefined;
  nativeClient?: string | undefined;
  fetchSite?: string | undefined;
  allowedOrigins: ReadonlySet<string>;
}): boolean {
  if (!UNSAFE_METHODS.has(input.method.toUpperCase())) return false;

  const cookiePresent = (input.cookie ?? '').split(';').some((part) =>
    part.trim().split('=', 1)[0] === 'omi_session',
  );
  if (!cookiePresent) return false;

  // A Tauri native request is authenticated by its bearer token instead
  // of the browser's cookie. HTML forms cannot supply these custom headers.
  if (
    input.nativeClient === '1' &&
    /^Bearer\s+\S+$/i.test(input.authorization?.trim() ?? '')
  ) {
    return false;
  }

  // Missing/opaque origins fail closed for credentialed browser writes.
  // A server-side client using cookie authentication must supply the exact
  // configured Origin or switch to bearer authentication.
  if (!input.origin || !input.allowedOrigins.has(input.origin)) return true;
  if (input.fetchSite?.toLowerCase() === 'cross-site') return true;
  return false;
}

export function cookieOriginGuard(allowedOrigins: ReadonlySet<string>) {
  return (request: Request, response: Response, next: NextFunction): void => {
    if (rejectsCookieOrigin({
      method: request.method,
      cookie: request.headers.cookie,
      origin: request.headers.origin,
      authorization: request.headers.authorization,
      nativeClient: request.headers['x-omi-native-client'] as string | undefined,
      fetchSite: request.headers['sec-fetch-site'] as string | undefined,
      allowedOrigins,
    })) {
      response.setHeader('Cache-Control', 'no-store');
      response.status(403).json({
        error: {
          code: 'COOKIE_ORIGIN_FORBIDDEN',
          message: 'An approved Origin is required for cookie-authenticated changes.',
        },
      });
      return;
    }
    next();
  };
}
