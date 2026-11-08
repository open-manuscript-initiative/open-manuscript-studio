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
  const publicPaths = new Set([
    '/api/server-registry/servers', '/api/v1/server-registry/servers',
    '/api/server-registry/servers/daily', '/api/v1/server-registry/servers/daily',
  ]);
  return (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method) && publicPaths.has(request.path)) {
      publicDirectory(request, response, next);
      return;
    }
    standard(request, response, next);
  };
}
