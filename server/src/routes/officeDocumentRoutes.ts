import { Router } from 'express';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';

import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';

export const officeDocumentRouter = Router();

const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(300),
  fileName: z.string().trim().min(1).max(255).regex(/\.docx$/i),
  contentBase64: z.string().min(1).max(28_000_000),
  authorName: z.string().trim().min(1).max(200),
  authorEmail: z.string().trim().email().max(320),
});
const idSchema = z.string().uuid();
const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_DOCX_BYTES = 20 * 1024 * 1024;

officeDocumentRouter.get('/office-documents/status', requireSession, (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    enabled: Boolean(env.EURO_OFFICE_SERVER_URL && env.EURO_OFFICE_JWT_SECRET),
    documentServerUrl: env.EURO_OFFICE_SERVER_URL ?? null,
  });
});

officeDocumentRouter.get('/office-documents', requireSession, async (request: AuthenticatedRequest, response) => {
  const documents = await prisma.officeDocument.findMany({
    where: { userId: request.authUserId! },
    select: {
      id: true, title: true, fileName: true, authorName: true,
      authorEmail: true, createdAt: true, updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ documents });
});

officeDocumentRouter.delete('/office-documents/:documentId', requireSession, async (request: AuthenticatedRequest, response) => {
  const parsedId = idSchema.safeParse(request.params.documentId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: 'INVALID_OFFICE_DOCUMENT_ID', message: 'The document ID is invalid.' } });
    return;
  }
  const result = await prisma.officeDocument.deleteMany({
    where: { id: parsedId.data, userId: request.authUserId! },
  });
  if (result.count === 0) {
    response.status(404).json({ error: { code: 'OFFICE_DOCUMENT_NOT_FOUND', message: 'The document was not found.' } });
    return;
  }
  response.status(204).end();
});

officeDocumentRouter.post('/office-documents', requireSession, async (request: AuthenticatedRequest, response) => {
  if (!isEnabled()) {
    response.status(503).json({ error: { code: 'EURO_OFFICE_NOT_CONFIGURED', message: 'Euro-Office is not configured on this Studio server.' } });
    return;
  }
  const parsed = createDocumentSchema.safeParse(request.body);
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'INVALID_OFFICE_DOCUMENT', message: 'Provide a title, author details, and a valid DOCX file.' } });
    return;
  }
  const fileBytes = Buffer.from(parsed.data.contentBase64, 'base64');
  if (!fileBytes.length || fileBytes.length > MAX_DOCX_BYTES || fileBytes[0] !== 0x50 || fileBytes[1] !== 0x4b) {
    response.status(400).json({ error: { code: 'INVALID_DOCX', message: 'The file must be a DOCX ZIP package smaller than 20 MB.' } });
    return;
  }
  const document = await prisma.officeDocument.create({
    data: {
      userId: request.authUserId!,
      title: parsed.data.title,
      fileName: parsed.data.fileName,
      contentType: DOCX_MIME,
      fileBytes,
      authorName: parsed.data.authorName,
      authorEmail: parsed.data.authorEmail,
    },
    select: {
      id: true, title: true, fileName: true, authorName: true,
      authorEmail: true, createdAt: true, updatedAt: true,
    },
  });
  response.status(201).json({ document });
});

officeDocumentRouter.get('/office-documents/:documentId/editor-config', requireSession, async (request: AuthenticatedRequest, response) => {
  if (!isEnabled()) {
    response.status(503).json({ error: { code: 'EURO_OFFICE_NOT_CONFIGURED', message: 'Euro-Office is not configured on this Studio server.' } });
    return;
  }
  const parsedId = idSchema.safeParse(request.params.documentId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: 'INVALID_OFFICE_DOCUMENT_ID', message: 'The document ID is invalid.' } });
    return;
  }
  const document = await prisma.officeDocument.findFirst({
    where: { id: parsedId.data, userId: request.authUserId! },
  });
  if (!document) {
    response.status(404).json({ error: { code: 'OFFICE_DOCUMENT_NOT_FOUND', message: 'The document was not found.' } });
    return;
  }

  const fileToken = await signOfficeToken(document.id, document.userId, 'download');
  const callbackToken = await signOfficeToken(document.id, document.userId, 'callback');
  const documentServerUrl = env.EURO_OFFICE_SERVER_URL!.replace(/\/+$/u, '');
  const origin = new URL(env.FRONTEND_ORIGIN).origin;
  const requestedLanguage = z.string().trim().regex(/^[a-z]{2}(?:-[A-Z]{2})?$/u).catch('en').parse(request.query.lang);
  const documentUrl = `${origin}/api/office-documents/${document.id}/content?token=${encodeURIComponent(fileToken)}`;
  const callbackUrl = `${origin}/api/office-documents/${document.id}/callback?token=${encodeURIComponent(callbackToken)}`;
  const editorConfiguration = {
    documentType: 'word',
    document: {
      fileType: 'docx',
      key: `${document.id}-${document.updatedAt.getTime()}`,
      title: document.fileName,
      url: documentUrl,
      permissions: { edit: true, download: true, print: true, comment: false, chat: false, review: false },
    },
    editorConfig: {
      mode: 'edit',
      lang: requestedLanguage,
      callbackUrl,
      user: { id: document.userId, name: document.authorName },
      customization: {
        forcesave: true,
        comments: false,
        review: { hideReviewDisplay: true, showReviewChanges: false, trackChanges: false },
      },
    },
  };
  const config = { ...editorConfiguration, token: await signEditorConfig(editorConfiguration) };
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    documentServerUrl,
    apiScriptUrl: `${documentServerUrl}/web-apps/apps/api/documents/api.js`,
    config,
    author: { name: document.authorName, email: document.authorEmail },
  });
});

// Euro-Office fetches documents directly from the Studio server. The short-lived
// signed token is scoped to one document and does not expose the user's session.
officeDocumentRouter.get('/office-documents/:documentId/content', async (request, response) => {
  const document = await resolveCapabilityDocument(request.params.documentId, request.query.token, 'download');
  if (!document) {
    response.status(403).end();
    return;
  }
  response.setHeader('Content-Type', document.contentType);
  response.setHeader('Content-Disposition', `attachment; filename="${safeFileName(document.fileName)}"`);
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Length', String(document.fileBytes.byteLength));
  response.status(200).send(Buffer.from(document.fileBytes));
});

// Euro-Office notifies the Studio when an editing session has saved a new DOCX.
officeDocumentRouter.post('/office-documents/:documentId/callback', async (request, response) => {
  const document = await resolveCapabilityDocument(request.params.documentId, request.query.token, 'callback');
  if (!document) {
    response.status(403).json({ error: 1 });
    return;
  }
  const payload = request.body as { status?: unknown; url?: unknown } | undefined;
  const status = Number(payload?.status);
  if (status !== 2 && status !== 6) {
    response.status(200).json({ error: 0 });
    return;
  }
  if (typeof payload?.url !== 'string' || !isDocumentServerUrl(payload.url)) {
    response.status(400).json({ error: 1 });
    return;
  }
  const downloaded = await fetch(payload.url, { signal: AbortSignal.timeout(30_000) });
  if (!downloaded.ok) {
    response.status(502).json({ error: 1 });
    return;
  }
  const fileBytes = Buffer.from(await downloaded.arrayBuffer());
  if (!isDocx(fileBytes)) {
    response.status(400).json({ error: 1 });
    return;
  }
  await prisma.officeDocument.update({
    where: { id: document.id },
    data: { fileBytes },
  });
  response.status(200).json({ error: 0 });
});

async function resolveCapabilityDocument(
  documentId: unknown,
  tokenValue: unknown,
  purpose: 'download' | 'callback',
) {
  const parsedId = idSchema.safeParse(documentId);
  if (!parsedId.success || typeof tokenValue !== 'string' || !env.EURO_OFFICE_JWT_SECRET) return null;
  try {
    const { payload } = await jwtVerify(tokenValue, jwtSecret(), { algorithms: ['HS256'] });
    if (payload.documentId !== parsedId.data || payload.purpose !== purpose || typeof payload.userId !== 'string') return null;
    return prisma.officeDocument.findFirst({
      where: { id: parsedId.data, userId: payload.userId },
    });
  } catch {
    return null;
  }
}

async function signOfficeToken(documentId: string, userId: string, purpose: 'download' | 'callback'): Promise<string> {
  return new SignJWT({ documentId, userId, purpose })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(jwtSecret());
}

async function signEditorConfig(payload: Record<string, unknown>): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(jwtSecret());
}

function jwtSecret(): Uint8Array {
  return new TextEncoder().encode(env.EURO_OFFICE_JWT_SECRET!);
}

function isEnabled(): boolean {
  return Boolean(env.EURO_OFFICE_SERVER_URL && env.EURO_OFFICE_JWT_SECRET);
}

function isDocumentServerUrl(value: string): boolean {
  try {
    const supplied = new URL(value);
    const configured = new URL(env.EURO_OFFICE_SERVER_URL!);
    return supplied.origin === configured.origin && supplied.protocol === configured.protocol;
  } catch {
    return false;
  }
}

function isDocx(bytes: Buffer): boolean {
  return bytes.byteLength > 0 && bytes.byteLength <= MAX_DOCX_BYTES && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

function safeFileName(value: string): string {
  return value.replace(/[\\"\r\n]/gu, '_');
}
