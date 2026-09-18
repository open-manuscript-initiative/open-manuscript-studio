import { Router } from 'express';
import { z } from 'zod';

import { requireSession } from '../middleware/requireSession.js';
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
      const artifact = await renderVivliostylePdf(parsed.data.html);
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
  const normalized = (value ?? 'manuscript.pdf')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:"<>|?*]+/g, '-')
    .trim()
    .slice(0, 180);
  const base = normalized || 'manuscript.pdf';
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}
