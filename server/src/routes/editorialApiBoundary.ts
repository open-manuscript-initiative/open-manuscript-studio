import { randomUUID } from 'node:crypto';
import type { RequestHandler, Response } from 'express';
/** Only mount this on the named routes; unrelated legacy paths are not deprecated. */
export function versionedEditorialBoundary(suffix: string): RequestHandler {
  return (request, response, next) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Request-Id', randomUUID());
    if (!request.baseUrl.startsWith('/api/v1')) {
      response.setHeader('Deprecation', '@1794960000'); // 2026-11-18 UTC; no removal date.
      response.setHeader(
        'Link',
        `</api/v1${suffix}${request.path === '/' ? '' : request.path}>; rel="successor-version"`,
      );
    }
    next();
  };
}
export function editorialError(
  response: Response,
  status: number,
  message: string,
) {
  const code =
    (
      {
        400: 'INVALID_REQUEST',
        401: 'NOT_AUTHENTICATED',
        403: 'FORBIDDEN',
        404: 'NOT_FOUND',
        409: 'CONFLICT',
        422: 'INVALID_PROPOSAL',
        502: 'CONNECTOR_FAILED',
        503: 'AUTHORITY_UNAVAILABLE',
      } as Record<number, string>
    )[status] ?? 'REQUEST_FAILED';
  response.status(status).json({ error: { code, message } });
}
