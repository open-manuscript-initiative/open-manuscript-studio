import { Router, type Response } from 'express';
import { z } from 'zod';
import { env } from '../config/env.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { createEuroOfficeSession, createPlainDocument, listPlainDocuments, euroOfficeContent, saveEuroOfficeCallback, listEuroOfficeSaves, downloadEuroOfficeSave, EuroOfficeError } from '../services/euroOfficeService.js';
export const euroOfficeRouter = Router();
const id = z.string().uuid();
const token = z.string().min(1).max(128);
const callbackSchema = z.object({ status: z.number().int(), key: z.string().max(128), url: z.string().url().max(4096).optional() });
const titleSchema = z.object({ title: z.string().trim().max(300).refine(value => ![...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)).optional() });
function failure(response: Response, error: unknown, callback = false) {
  const status = error instanceof EuroOfficeError ? error.status : error instanceof z.ZodError ? 400 : 502;
  response.status(status).json(callback ? { error: 1 } : { error: { code: error instanceof EuroOfficeError ? error.code : 'EUROOFFICE_REQUEST_FAILED', message: 'The document request could not be completed.' } });
}
function content(response: Response) {
  response.type('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}
euroOfficeRouter.use(['/eurooffice', '/integrations/eurooffice'], (_request, response, next) => { response.setHeader('Cache-Control', 'private, no-store'); next(); });
euroOfficeRouter.get('/eurooffice/status', requireSession, (_request, response) => { response.json({ enabled: env.EUROOFFICE_ENABLED }); });
euroOfficeRouter.get('/eurooffice/documents', requireSession, async (request: AuthenticatedRequest, response) => {
  try { response.json(await listPlainDocuments(request.authUserId!)); } catch(error) { failure(response, error); }
});
euroOfficeRouter.post('/eurooffice/documents', requireSession, async (request: AuthenticatedRequest, response) => {
  try { const input = titleSchema.parse(request.body ?? {}); response.status(201).json(await createPlainDocument(request.authUserId!, input.title || 'Untitled document')); } catch(error) { failure(response, error); }
});
euroOfficeRouter.get('/eurooffice/documents/:documentId/session', requireSession, async (request: AuthenticatedRequest, response) => {
  try { response.json(await createEuroOfficeSession(request.authUserId!, id.parse(request.params.documentId), request.acceptsLanguages('hu','de','en'), request.query.type === 'mobile' ? 'mobile' : 'desktop')); } catch(error) { failure(response, error); }
});
euroOfficeRouter.get('/eurooffice/documents/:documentId/saves', requireSession, async (request: AuthenticatedRequest, response) => {
  try { response.json(await listEuroOfficeSaves(request.authUserId!, id.parse(request.params.documentId))); } catch(error) { failure(response, error); }
});
euroOfficeRouter.get('/eurooffice/documents/:documentId/saves/:saveId', requireSession, async (request: AuthenticatedRequest, response) => {
  try { const bytes = await downloadEuroOfficeSave(request.authUserId!, id.parse(request.params.documentId), id.parse(request.params.saveId)); content(response); response.setHeader('Content-Disposition', 'attachment; filename="recovered-document.docx"'); response.send(Uint8Array.from(bytes)); } catch(error) { failure(response, error); }
});
euroOfficeRouter.get('/integrations/eurooffice/:documentId/content', async (request, response) => {
  try { const bytes = await euroOfficeContent(id.parse(request.params.documentId), token.parse(request.query.token)); content(response); response.send(Uint8Array.from(bytes)); } catch(error) { failure(response, error); }
});
euroOfficeRouter.post('/integrations/eurooffice/:documentId/callback', async (request, response) => {
  try { await saveEuroOfficeCallback(id.parse(request.params.documentId), token.parse(request.query.token), callbackSchema.parse(request.body)); response.json({ error: 0 }); } catch(error) { failure(response, error, true); }
});
