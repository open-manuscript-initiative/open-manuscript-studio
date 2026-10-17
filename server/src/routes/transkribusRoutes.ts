import { Router, type Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { TranskribusError, TRANSKRIBUS_MAX_IMAGE_BYTES } from '../integrations/transkribus/client.js';
import {
  connectTranskribus, disconnectTranskribus, transkribusConnectionStatus,
  submitTranskribusJob, getTranskribusJob, getTranskribusPageXml,
} from '../integrations/transkribus/service.js';
import { requireModuleCapability } from '../middleware/requireModuleCapability.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';

export const transkribusRouter = Router();
const base = '/modules/critical-text-edition/transkribus/jobs';
const authenticated = (request: AuthenticatedRequest) => request.authUserId!;
const limit = (requests: number, windowMs = 60_000) => rateLimit({
  windowMs, limit: requests, keyGenerator: request => authenticated(request as AuthenticatedRequest),
  standardHeaders: 'draft-8', legacyHeaders: false,
  message: { error: { code: 'TRANSKRIBUS_RATE_LIMIT' } },
});
const loginLimit = limit(8, 5 * 60_000);
const submitLimit = limit(6);
const readLimit = limit(60);
const capability = requireModuleCapability('org.omi.critical-text-edition', 'transkribus.recognize');
const loginSchema = z.object({ username: z.string().trim().min(1).max(320), password: z.string().min(1).max(4096) }).strict();
const jobSchema = z.object({
  modelId: z.number().int().positive().max(2_147_483_647),
  imageBase64: z.string().min(1).max(Math.ceil(TRANSKRIBUS_MAX_IMAGE_BYTES / 3) * 4),
  consent: z.literal(true),
}).strict();

function failure(response: Response, error: unknown): void {
  response.status(error instanceof TranskribusError ? error.httpStatus : 502)
    .json({ error: { code: error instanceof TranskribusError ? error.code : 'TRANSKRIBUS_UNAVAILABLE' } });
}

transkribusRouter.use(['/integrations/transkribus/connection', base], (_request, response, next) => {
  response.setHeader('Cache-Control', 'no-store');
  next();
});

transkribusRouter.get('/integrations/transkribus/connection', requireSession,
  async (request: AuthenticatedRequest, response) => {
    try { response.json(await transkribusConnectionStatus(authenticated(request))); }
    catch (error) { failure(response, error); }
  });

transkribusRouter.post('/integrations/transkribus/connection', requireSession, loginLimit,
  async (request: AuthenticatedRequest, response) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: { code: 'TRANSKRIBUS_INVALID_LOGIN' } }); return; }
    try {
      await connectTranskribus(authenticated(request), parsed.data.username, parsed.data.password);
      response.json(await transkribusConnectionStatus(authenticated(request)));
    } catch (error) { failure(response, error); }
  });

transkribusRouter.delete('/integrations/transkribus/connection', requireSession,
  async (request: AuthenticatedRequest, response) => {
    try { await disconnectTranskribus(authenticated(request)); response.status(204).end(); }
    catch (error) { failure(response, error); }
  });

transkribusRouter.post(base, requireSession, capability, submitLimit,
  async (request: AuthenticatedRequest, response) => {
    const parsed = jobSchema.safeParse(request.body);
    if (!parsed.success) { response.status(400).json({ error: { code: 'TRANSKRIBUS_INVALID_REQUEST' } }); return; }
    try { response.status(201).json(await submitTranskribusJob(authenticated(request), parsed.data.modelId, parsed.data.imageBase64)); }
    catch (error) { failure(response, error); }
  });

transkribusRouter.get(`${base}/:handle`, requireSession, capability, readLimit,
  async (request: AuthenticatedRequest, response) => {
    try { response.json(await getTranskribusJob(authenticated(request), String(request.params.handle))); }
    catch (error) { failure(response, error); }
  });

transkribusRouter.get(`${base}/:handle/page`, requireSession, capability, readLimit,
  async (request: AuthenticatedRequest, response) => {
    try {
      const xml = await getTranskribusPageXml(authenticated(request), String(request.params.handle));
      response.type('application/xml').setHeader('Content-Disposition', 'attachment; filename="transkribus-page.xml"');
      response.send(xml);
    } catch (error) { failure(response, error); }
  });
