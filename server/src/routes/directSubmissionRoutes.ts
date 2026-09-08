import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import { assertTrustedIntegrationUrl } from '../integrations/security/trustedRemoteUrl.js';
import { createRemoteSubmission, directSubmissionInput, finalizeRemoteSubmission, prepareRemoteSubmission, record, submissionDigest, type RemoteRequest } from '../integrations/publishing/directSubmission.js';

export const directSubmissionRouter = Router();
const requestSchema = z.object({
  action: z.enum(['options', 'status', 'prepare', 'submit']),
  manuscriptId: z.string().min(1).max(128),
  apiKey: z.string().trim().min(1).max(4096).optional(),
  input: directSubmissionInput.optional(),
  digest: z.string().length(64).optional(),
  confirmed: z.literal(true).optional(),
});
class RemoteError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}
function publicReceipt(row: { id: string; status: string; externalId: number | null; digest: string; baseUrl: string }) {
  return { id: row.id, status: row.status, externalId: row.externalId, digest: row.digest,
    url: row.externalId ? `${row.baseUrl}/authorDashboard/submission/${row.externalId}` : null };
}
function nativeClient(baseUrl: string, apiKey?: string): RemoteRequest {
  return async (method, path, body) => {
    if (!/^(omi-integration\/submission-options|submissions(?:\/\d+(?:\/(?:files(?:\/\d+)?|submit|publications\/\d+(?:\/contributors(?:\/\d+)?)?))?)?)$/.test(path)) {
      throw new Error('Invalid publishing operation.');
    }
    const url = await assertTrustedIntegrationUrl(`${baseUrl}/api/v1/${path}`, baseUrl);
    const headers = new Headers({ Accept: 'application/json' });
    if (apiKey) headers.set('Authorization', `Bearer ${apiKey}`);
    const init: RequestInit = { method, headers, redirect: 'error', signal: AbortSignal.timeout(30000) };
    if (body instanceof FormData) init.body = body;
    else if (body) { headers.set('Content-Type', 'application/json'); init.body = JSON.stringify(body); }
    const response = await fetch(url, init);
    const text = await response.text();
    if (text.length > 4000000) throw new Error('The publishing response is too large.');
    let result: unknown;
    try { result = JSON.parse(text); } catch { throw new RemoteError(response.status, `Publishing API returned HTTP ${response.status} without JSON. Check the plugin and API URL.`); }
    if (!response.ok) {
      const detail = JSON.stringify(result).slice(0, 3000).split(apiKey || '\u0000').join('[redacted]');
      throw new RemoteError(response.status, `Publishing API: HTTP ${response.status}. ${detail}`);
    }
    return result;
  };
}

directSubmissionRouter.post('/integrations/connections/:connectionId/direct-submission', requireSession, async (request: AuthenticatedRequest, response) => {
  response.setHeader('Cache-Control', 'no-store');
  const body = requestSchema.safeParse(request.body);
  const connectionId = z.string().uuid().safeParse(request.params.connectionId);
  if (!body.success || !connectionId.success) {
    response.status(400).json({ error: { message: 'Invalid submission request.' } }); return;
  }
  const data = body.data;
  const connection = await prisma.userIntegration.findFirst({ where: {
    id: connectionId.data, userId: request.authUserId!, enabled: true, providerId: { in: ['ojs', 'omp'] },
  } });
  const configuredBase = record(connection?.config).baseUrl;
  if (!connection || typeof configuredBase !== 'string') {
    response.status(404).json({ error: { message: 'Publishing connection not found or disabled.' } }); return;
  }
  let baseUrl: string;
  try { baseUrl = (await assertTrustedIntegrationUrl(configuredBase, configuredBase)).toString().replace(/\/+$/, ''); }
  catch { response.status(400).json({ error: { message: 'The publishing connection must use an allowed public HTTPS URL.' } }); return; }
  const key = { userId: request.authUserId!, connectionId: connection.id, manuscriptId: data.manuscriptId };
  const where = { userId_connectionId_manuscriptId: key };
  let row = await prisma.directSubmission.findUnique({ where });
  if (data.action === 'status') {
    if (row?.status === 'SUBMITTING' && row.externalId && data.apiKey && row.baseUrl === baseUrl && row.updatedAt.getTime() < Date.now() - 2 * 60000) {
      try {
        const current = record(await nativeClient(baseUrl, data.apiKey)('GET', `submissions/${row.externalId}`));
        if (typeof current.submissionProgress === 'string') {
          await prisma.directSubmission.updateMany({ where: { id: row.id, status: 'SUBMITTING', updatedAt: row.updatedAt }, data: { status: current.submissionProgress === '' ? 'SUBMITTED' : 'READY' } });
          row = await prisma.directSubmission.findUnique({ where });
        }
      } catch { /* Keep the uncertain state until the destination can be checked. */ }
    }
    response.json({ receipt: row ? publicReceipt(row) : null }); return;
  }
  if (data.action === 'options') {
    try {
      const options = record(await nativeClient(baseUrl)('GET', 'omi-integration/submission-options'));
      if (options.protocol !== 'omi-direct-submission/1' || options.platform !== connection.providerId) throw new Error('Update the matching OMI publishing plugin to enable direct submissions.');
      response.json({ options });
    } catch (error) { response.status(502).json({ error: { message: error instanceof Error ? error.message : 'Unable to read submission requirements.' } }); }
    return;
  }
  if (!data.apiKey) { response.status(400).json({ error: { message: 'An author API key from the publishing system is required.' } }); return; }
  if (row && row.baseUrl !== baseUrl) { response.status(409).json({ error: { message: 'The destination URL has changed. Restore the original connection before continuing this submission.' } }); return; }
  const remote = nativeClient(baseUrl, data.apiKey);
  let acquired = false;
  try {
    if (data.action === 'prepare') {
      const input = data.input;
      if (!input || input.manuscriptId !== data.manuscriptId) throw new Error('A matching manuscript snapshot is required.');
      const omi = record(JSON.parse(input.omi));
      if (omi.id !== input.manuscriptId || !Array.isArray(omi.sections) || Buffer.from(input.docx, 'base64').subarray(0,4).toString('hex') !== '504b0304') throw new Error('Invalid OMI or DOCX manuscript file.');
      const options = record(await remote('GET', 'omi-integration/submission-options'));
      if (options.protocol !== 'omi-direct-submission/1' || options.platform !== connection.providerId || options.acceptingSubmissions !== true) throw new Error('The destination is not accepting direct submissions.');
      if (!Array.isArray(options.locales) || !options.locales.includes(input.locale)) throw new Error('Choose a supported submission language.');
      if (!Array.isArray(options.genres) || !options.genres.some((g) => record(g).id === input.genreId)) throw new Error('Choose a supported file component.');
      if (connection.providerId === 'ojs' && input.sectionId === null) throw new Error('Choose a journal section.');
      if (input.sectionId !== null && (!Array.isArray(options.sections) || !options.sections.some((s) => record(s).id === input.sectionId))) throw new Error('Choose an available section or series.');
      const digest = submissionDigest(input);
      row = await prisma.directSubmission.upsert({ where, update: {}, create: { ...key, baseUrl, digest } });
      const lock = await prisma.directSubmission.updateMany({ where: { id: row.id, OR: [
        { status: { in: ['NEW', 'REJECTED', 'FAILED', 'READY'] } },
        { status: 'PREPARING', externalId: { not: null }, updatedAt: { lt: new Date(Date.now() - 10 * 60000) } },
      ] }, data: { status: 'PREPARING' } });
      if (!lock.count) throw new Error('This submission is complete, busy, or has an uncertain creation result. Check its status before creating another submission.');
      acquired = true;
      row = await prisma.directSubmission.findUniqueOrThrow({ where: { id: row.id } });
      if (row.externalId === null) {
        await prisma.directSubmission.update({ where: { id: row.id }, data: { status: 'CREATING' } });
        try {
          const ids = await createRemoteSubmission(remote, connection.providerId, input);
          row = await prisma.directSubmission.update({ where: { id: row.id }, data: { ...ids, status: 'PREPARING' } });
        } catch (error) {
          await prisma.directSubmission.update({ where: { id: row.id }, data: { status: error instanceof RemoteError && error.status >= 400 && error.status < 500 ? 'REJECTED' : 'UNKNOWN' } });
          acquired = false;
          throw error;
        }
      }
      if (!row.externalId || !row.publicationId) throw new Error('The destination draft identifiers are unavailable.');
      await prepareRemoteSubmission(remote, { externalId: row.externalId, publicationId: row.publicationId }, input, row.digest !== digest);
      row = await prisma.directSubmission.update({ where: { id: row.id }, data: { status: 'READY', digest } });
    } else {
      if (!row || !row.externalId || !data.confirmed || row.digest !== data.digest) throw new Error('Prepare and confirm this manuscript snapshot before submitting.');
      if (row.status === 'SUBMITTED') { response.json({ receipt: publicReceipt(row) }); return; }
      const lock = await prisma.directSubmission.updateMany({ where: { id: row.id, digest: data.digest, OR: [
        { status: 'READY' }, { status: 'SUBMITTING', updatedAt: { lt: new Date(Date.now() - 2 * 60000) } },
      ] }, data: { status: 'SUBMITTING' } });
      if (!lock.count) throw new Error('The submission is not ready or is already being submitted.');
      await finalizeRemoteSubmission(remote, row.externalId);
      row = await prisma.directSubmission.update({ where: { id: row.id }, data: { status: 'SUBMITTED' } });
    }
    response.json({ receipt: publicReceipt(row) });
  } catch (error) {
    if (row && acquired) await prisma.directSubmission.updateMany({ where: { id: row.id, status: 'PREPARING' }, data: { status: 'FAILED' } });
    const latest = await prisma.directSubmission.findUnique({ where });
    response.status(409).json({ error: { message: error instanceof Error ? error.message : 'The submission could not be completed.' }, receipt: latest ? publicReceipt(latest) : null });
  }
});
