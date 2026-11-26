import { Router, raw } from 'express';
import { configuredPdfWorkerSocket, dispatchPdfWorkerTask } from '../security/pdfWorkerTransport.js';
import { encodeIssuePdfSlice, MAX_ISSUE_PDF_BYTES } from '../services/issuePdfSlice.js';
import { z } from 'zod';

import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';
import {
  MAX_VIVLIOSTYLE_HTML_BYTES,
  VivliostylePdfError,
  renderVivliostylePdf,
} from '../services/vivliostylePdfRenderer.js';

export const publicationPdfRouter = Router();

const requestSchema = z.object({
  html: z
    .string()
    .min(1)
    .refine(
      (value) => Buffer.byteLength(value, 'utf8') <= MAX_VIVLIOSTYLE_HTML_BYTES,
      'PDF source HTML is too large.',
    ),
  fileName: z.string().trim().min(1).max(240).optional(),
});

publicationPdfRouter.post(
  '/render/pdf',
  requireSession,
  async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');

    const parsed = requestSchema.safeParse(request.body);
    if (!parsed.success) {
      response.status(400).json({
        error: {
          code: 'INVALID_PDF_RENDER_REQUEST',
          message: 'Provide self-contained HTML within the PDF rendering size limit.',
        },
      });
      return;
    }

    try {
      // The shared Unix-socket worker enforces per-user admission across API
      // replicas; never allow a caller to choose the queue identity.
      const userId = (request as AuthenticatedRequest).authUserId;
      if (!userId) { response.sendStatus(401); return; }
      const artifact = await renderVivliostylePdf(parsed.data.html, userId);
      const fileName = safePdfFileName(parsed.data.fileName);

      response.status(200);
      response.setHeader('Content-Type', 'application/pdf');
      response.setHeader(
        'Content-Disposition',
        `attachment; filename="${fileName}"`,
      );
      response.setHeader('X-OMI-PDF-Renderer', artifact.renderer);
      response.setHeader(
        'X-OMI-PDF-Renderer-Version',
        artifact.rendererVersion,
      );
      response.send(Buffer.from(artifact.bytes));
    } catch (error) {
      if (error instanceof VivliostylePdfError) {
        const status = error.code === 'PDF_INPUT_UNSAFE'
          ? 400
          : error.code === 'PDF_RENDERER_UNAVAILABLE'
            ? 503
            : 422;
        response.status(status).json({
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      console.error('Vivliostyle PDF rendering failed:', error);
      response.status(503).json({
        error: {
          code: 'PDF_RENDERER_UNAVAILABLE',
          message: 'The PDF renderer is temporarily unavailable.',
        },
      });
    }
  },
);

function safePdfFileName(value: string | undefined): string {
  const normalized = stripControlCharacters(value ?? 'manuscript.pdf')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._ -]+/g, '-')
    .replace(/[\\/:"<>|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
  const base = normalized || 'manuscript.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

function stripControlCharacters(value: string): string {
  return Array.from(value)
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 0x1f && code !== 0x7f;
    })
    .join('');
}


// Never invoke a PDF parser inside the API process, even in development.
publicationPdfRouter.post('/slice/pdf', requireSession,
  raw({ type: 'application/pdf', limit: MAX_ISSUE_PDF_BYTES, inflate: false }),
  async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const owner = (request as AuthenticatedRequest).authUserId;
    if (!owner) { response.sendStatus(401); return; }
    const query = z.object({ firstPage: z.string().regex(/^[1-9][0-9]{0,3}$/), lastPage: z.string().regex(/^[1-9][0-9]{0,3}$/) }).safeParse(request.query);
    if (!query.success || !Buffer.isBuffer(request.body)) {
      response.status(400).json({ error: { code: 'INVALID_PDF_SLICE', message: 'Provide a PDF and an inclusive physical page range.' } });
      return;
    }
    let input: Buffer;
    try {
      input = encodeIssuePdfSlice(request.body, Number(query.data.firstPage), Number(query.data.lastPage));
    } catch {
      response.status(400).json({ error: { code: 'INVALID_PDF_SLICE', message: 'Invalid PDF or page range.' } });
      return;
    }
    try {
      const socket = configuredPdfWorkerSocket();
      if (!socket) throw new Error('Missing worker');
      const bytes = await dispatchPdfWorkerTask('slice', input, owner, socket, 190_000);
      if (bytes.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Invalid output');
      response.status(200).type('application/pdf').attachment('article.pdf').send(bytes);
    } catch {
      response.status(503).json({ error: { code: 'PDF_SLICE_FAILED', message: 'The isolated PDF extraction could not complete. Check the physical page range and worker availability.' } });
    }
  });


publicationPdfRouter.post('/inspect/pdf-pages', requireSession,
  raw({ type: 'application/pdf', limit: MAX_ISSUE_PDF_BYTES, inflate: false }),
  async (request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('X-Content-Type-Options', 'nosniff');
    const owner = (request as AuthenticatedRequest).authUserId;
    if (!owner) { response.sendStatus(401); return; }
    const body: unknown = request.body;
    if (!Buffer.isBuffer(body) || body.length < 5 ||
        body.length > MAX_ISSUE_PDF_BYTES || body.subarray(0, 5).toString('ascii') !== '%PDF-') {
      response.status(400).json({ error: { code: 'INVALID_ISSUE_PDF', message: 'Provide the rendered issue PDF.' } });
      return;
    }
    try {
      const socket = configuredPdfWorkerSocket();
      if (!socket) throw new Error('Missing worker');
      const bytes = await dispatchPdfWorkerTask('page-text', body, owner, socket, 140_000);
      const parsed = z.object({ pageCount: z.number().int().min(1).max(2000), pages: z.array(z.string()).min(1).max(2000) }).parse(JSON.parse(bytes.toString('utf8')));
      if (parsed.pages.length !== parsed.pageCount) throw new Error('Invalid page evidence');
      response.status(200).json(parsed);
    } catch {
      response.status(503).json({ error: { code: 'PDF_PAGE_INSPECTION_FAILED', message: 'The isolated worker could not inspect the PDF pages.' } });
    }
  });
