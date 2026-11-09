import cors from 'cors';
import type {RequestHandler} from 'express';

export function apiCors(allowedOrigins: ReadonlySet<string>): RequestHandler {
  const standard = cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) { callback(null, true); return; }
      callback(new Error(`Origin ${origin} is not allowed by CORS.`));
    },
    credentials: true,
  });
  const publicDirectory = cors({origin: true, credentials: false});
  // The confirmation/cancellation links are opened as top-level HTML pages,
  // often in an e-mail client's in-app browser. These endpoints never use
  // cookie authentication: their authority comes solely from a one-time token.
  // They do not require cross-origin JavaScript access, so do not apply the
  // credentialed API CORS callback (which turns foreign Origin into HTTP 500).
  // Never return Access-Control-Allow-Origin or allow credentials here.
  const publicEmailLink = cors({origin: false, credentials: false});
  const publicEmailPaths = new Set([
    '/api/public/android-test/confirm',
    '/api/public/android-test/unsubscribe',
  ]);
  // Do not widen cookie-authenticated API CORS to the marketing website.
  // This one anonymous form accepts only the canonical OMI website origin.
  const publicSignup = cors({
    origin(origin, callback) {
      callback(null, origin === 'https://openmanuscript.org' || origin === 'https://www.openmanuscript.org');
    },
    credentials: false,
  });
  const publicPaths = new Set([
    '/api/server-registry/servers', '/api/v1/server-registry/servers',
    '/api/server-registry/servers/daily', '/api/v1/server-registry/servers/daily',
  ]);
  return (request, response, next) => {
    if (request.path === '/api/public/android-test/signups' && ['POST', 'OPTIONS'].includes(request.method)) {
      publicSignup(request, response, next);
      return;
    }
    if (publicEmailPaths.has(request.path) && ['GET', 'HEAD', 'POST'].includes(request.method)) {
      publicEmailLink(request, response, next);
      return;
    }
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) && publicPaths.has(request.path)) {
      publicDirectory(request, response, next);
      return;
    }
    standard(request, response, next);
  };
}
