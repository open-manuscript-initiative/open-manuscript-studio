import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import * as service from '../services/serverRegistryService.js';
import { DIRECTORY_REFRESH_SECONDS } from '../serverRegistry/policy.js';
import {publicServerIdentity} from '../serverRegistry/identity.js';

export const serverRegistryRouter = Router();
const registrationLimit = rateLimit({ windowMs: 3600000, limit: 10 });
const verificationLimit = rateLimit({ windowMs: 3600000, limit: 20 });
const announcementLimit = rateLimit({ windowMs: 3600000, limit: 60 });

serverRegistryRouter.get('/identity', (request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const identity = publicServerIdentity(request.query.challenge);
  if (!identity) { response.status(404).end(); return; }
  response.json(identity);
});
for (const [method, path, handler, limit] of [
  ['post', '/registrations', service.register, registrationLimit],
  ['post', '/announcements', service.announce, announcementLimit],
  ['post', '/registrations/:id/verify', service.verify, verificationLimit],
  ['post', '/instances/:id/heartbeat', service.heartbeat, undefined],
  ['post', '/instances/:id/rotate-token', service.rotate, undefined],
  ['delete', '/instances/:id', service.revoke, undefined],
  ['get', '/servers', service.list, undefined],
  ['get', '/servers/daily', service.dailyList, undefined],
] as const) {
  serverRegistryRouter[method](path, ...(limit ? [limit] : []), async (request, response) => {
    const id = request.params.id;
    const result = await handler(request.body, typeof id === 'string' ? id : id?.[0], request.header('authorization'));
    response.setHeader('Cache-Control', method === 'get'
      ? `public, max-age=${path === '/servers/daily' ? DIRECTORY_REFRESH_SECONDS : 60}, must-revalidate`
      : 'no-store');
    response.status(result.status);
    if (result.body === undefined) response.end();
    else response.json(result.body);
  });
}
