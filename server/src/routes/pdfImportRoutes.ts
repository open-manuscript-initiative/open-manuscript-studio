import express, { Router } from 'express';

import {
  createPdfImportJob,
  getPdfImportJob,
  getPdfImportResult,
} from '../import/pdf/pdfImportService.js';
import {
  requireSession,
  type AuthenticatedRequest,
} from '../middleware/requireSession.js';

export const pdfImportRouter = Router();

const pdfBody = express.raw({
  type: ['application/pdf', 'application/octet-stream'],
  limit: '100mb',
});

pdfImportRouter.use(requireSession);

pdfImportRouter.post('/pdf', pdfBody, (request: AuthenticatedRequest, response) => {
  if (!request.authUserId) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }
  if (!Buffer.isBuffer(request.body)) {
    response.status(400).json({ error: { code: 'PDF_BODY_REQUIRED', message: 'A PDF request body is required.' } });
    return;
  }

  const pdfBytes = Buffer.from(request.body);

  try {
    const rawName = String(request.header('X-OMI-File-Name') ?? 'document.pdf');
    const fileName = decodeURIComponent(rawName);
    const job = createPdfImportJob(request.authUserId, fileName, pdfBytes);
    response.status(202).json({ job });
  } catch (error) {
    response.status(400).json({
      error: {
        code: 'PDF_IMPORT_REJECTED',
        message: error instanceof Error ? error.message : 'PDF import could not be started.',
      },
    });
  }
});

pdfImportRouter.get('/pdf/:jobId', (request: AuthenticatedRequest, response) => {
  if (!request.authUserId) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }
  const jobId = request.params.jobId;
  if (typeof jobId !== 'string' || !jobId) {
    response.status(400).json({ error: { code: 'PDF_IMPORT_JOB_ID_REQUIRED', message: 'A PDF import job id is required.' } });
    return;
  }
  const job = getPdfImportJob(request.authUserId, jobId);
  if (!job) {
    response.status(404).json({ error: { code: 'PDF_IMPORT_NOT_FOUND', message: 'PDF import job not found.' } });
    return;
  }
  response.status(200).json({ job });
});

pdfImportRouter.get('/pdf/:jobId/result', (request: AuthenticatedRequest, response) => {
  if (!request.authUserId) {
    response.status(401).json({ error: { code: 'UNAUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }
  const jobId = request.params.jobId;
  if (typeof jobId !== 'string' || !jobId) {
    response.status(400).json({ error: { code: 'PDF_IMPORT_JOB_ID_REQUIRED', message: 'A PDF import job id is required.' } });
    return;
  }
  const job = getPdfImportJob(request.authUserId, jobId);
  if (!job) {
    response.status(404).json({ error: { code: 'PDF_IMPORT_NOT_FOUND', message: 'PDF import job not found.' } });
    return;
  }
  if (job.status !== 'completed') {
    response.status(409).json({
      error: {
        code: 'PDF_IMPORT_NOT_READY',
        message: job.error ?? 'PDF import is not complete yet.',
      },
    });
    return;
  }
  const result = getPdfImportResult(request.authUserId, jobId);
  if (!result) {
    response.status(404).json({ error: { code: 'PDF_IMPORT_RESULT_NOT_FOUND', message: 'PDF import result is unavailable.' } });
    return;
  }
  response.status(200).json({ result });
});
