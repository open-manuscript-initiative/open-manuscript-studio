import { createHash, randomBytes } from 'node:crypto';

import { SignJWT } from 'jose';
import { Router } from 'express';
import { z } from 'zod';

import { createBlankDocx } from '../integrations/eurooffice/blankDocx.js';
import { env } from '../config/env.js';
import { prisma } from '../lib/prisma.js';
import { requireSession, type AuthenticatedRequest } from '../middleware/requireSession.js';

export const euroOfficeRouter = Router();
const MAX_DOCX_BYTES = 25 * 1024 * 1024;
const SESSION_LIFETIME_MS = 8 * 60 * 60 * 1000;
const createDocumentSchema = z.object({
  // eslint-disable-next-line no-control-regex -- Reject control characters in user supplied titles.
  title: z.string().trim().max(300).regex(/^[^\u0000-\u001f\u007f]*$/).optional(),
});
const documentIdSchema = z.string().uuid();
const callbackSchema = z.object({
  status: z.number().int(),
  key: z.string().max(128).optional(),
  url: z.string().url().max(4096).optional(),
});

function tokenDigest(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function isEnabled(): boolean {
  return env.EUROOFFICE_ENABLED;
}

function requireEuroOffice(response: import('express').Response): boolean {
  if (isEnabled()) return true;
  response.status(503).json({
    error: { code: 'EUROOFFICE_NOT_CONFIGURED', message: 'EuroOffice is not configured on this Studio server.' },
  });
  return false;
}

function authorizedContentType(response: import('express').Response): void {
  response.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  response.setHeader('Cache-Control', 'private, no-store');
  response.setHeader('X-Content-Type-Options', 'nosniff');
}

euroOfficeRouter.get('/eurooffice/status', requireSession, (_request, response) => {
  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({ enabled: isEnabled() });
});

euroOfficeRouter.get('/eurooffice/documents', requireSession, async (request: AuthenticatedRequest, response) => {
  if (!requireEuroOffice(response)) return;
  const documents = await prisma.plainDocument.findMany({
    where: { userId: request.authUserId! },
    select: { id: true, title: true, revision: true, createdAt: true, updatedAt: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });
  response.status(200).json({ documents: documents.map((document) => ({
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  })) });
});

euroOfficeRouter.post('/eurooffice/documents', requireSession, async (request: AuthenticatedRequest, response) => {
  if (!requireEuroOffice(response)) return;
  const parsed = createDocumentSchema.safeParse(request.body ?? {});
  if (!parsed.success) {
    response.status(400).json({ error: { code: 'INVALID_DOCUMENT_TITLE', message: 'The document title is invalid.' } });
    return;
  }
  const title = parsed.data.title || 'Untitled document';
  const document = await prisma.plainDocument.create({
    data: { userId: request.authUserId!, title, content: Uint8Array.from(createBlankDocx(title)) },
    select: { id: true, title: true, revision: true, createdAt: true, updatedAt: true },
  });
  response.status(201).json({ document: {
    ...document,
    createdAt: document.createdAt.toISOString(),
    updatedAt: document.updatedAt.toISOString(),
  } });
});

euroOfficeRouter.get('/eurooffice/documents/:documentId/session', requireSession, async (request: AuthenticatedRequest, response) => {
  if (!requireEuroOffice(response)) return;
  const parsedId = documentIdSchema.safeParse(request.params.documentId);
  if (!parsedId.success) {
    response.status(400).json({ error: { code: 'INVALID_DOCUMENT_ID', message: 'The document ID is invalid.' } });
    return;
  }

  const document = await prisma.plainDocument.findFirst({
    where: { id: parsedId.data, userId: request.authUserId! },
    select: { id: true, title: true, revision: true },
  });
  if (!document) {
    response.status(404).json({ error: { code: 'DOCUMENT_NOT_FOUND', message: 'The document was not found.' } });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: request.authUserId! }, select: { fullName: true } });
  if (!user) {
    response.status(401).json({ error: { code: 'NOT_AUTHENTICATED', message: 'Authentication is required.' } });
    return;
  }

  const token = randomBytes(32).toString('base64url');
  const documentKey = `${document.id}-${document.revision}`;
  const expiresAt = new Date(Date.now() + SESSION_LIFETIME_MS);
  await prisma.euroOfficeSession.create({
    data: {
      documentId: document.id,
      userId: request.authUserId!,
      tokenHash: tokenDigest(token),
      documentKey,
      expiresAt,
    },
  });

  const serverUrl = env.EUROOFFICE_URL!;
  const studioUrl = env.FRONTEND_ORIGIN.replace(/\/+$/, '');
  const acceptedLanguage = request.acceptsLanguages('hu', 'de', 'en');
  const capability = encodeURIComponent(token);
  const contentUrl = `${studioUrl}/api/integrations/eurooffice/${document.id}/content?token=${capability}`;
  const callbackUrl = `${studioUrl}/api/integrations/eurooffice/${document.id}/callback?token=${capability}`;
  const config = {
    document: {
      fileType: 'docx',
      key: documentKey,
      title: `${document.title}.docx`,
      url: contentUrl,
      permissions: { edit: true, download: true, print: true, review: false, comment: false },
    },
    documentType: 'word',
    editorConfig: {
      callbackUrl,
      lang: typeof acceptedLanguage === 'string' ? acceptedLanguage : 'en',
      user: { id: request.authUserId!, name: user.fullName },
      customization: {
        forcesave: true,
        // Keep the editor header compact on both desktop and mobile layouts.
        compactHeader: true,
      },
    },
    height: '100%',
    width: '100%',
    type: request.query.type === 'mobile' ? 'mobile' : 'desktop',
  };

  const jwt = await new SignJWT(config)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(Buffer.from(env.EUROOFFICE_JWT_SECRET!));

  response.setHeader('Cache-Control', 'no-store');
  response.status(200).json({
    apiScriptUrl: `${serverUrl}/web-apps/apps/api/documents/api.js`,
    config: { ...config, token: jwt },
    expiresAt: expiresAt.toISOString(),
  });
});

// These expiring capability endpoints are called by the EuroOffice Document Server.
euroOfficeRouter.get('/integrations/eurooffice/:documentId/content', async (request, response) => {
  if (!requireEuroOffice(response)) return;
  const parsedId = documentIdSchema.safeParse(request.params.documentId);
  const token = typeof request.query.token === 'string' ? request.query.token : '';
  if (!parsedId.success || !token || token.length > 128) {
    response.status(404).end();
    return;
  }
  const session = await prisma.euroOfficeSession.findFirst({
    where: { documentId: parsedId.data, tokenHash: tokenDigest(token), expiresAt: { gt: new Date() } },
    include: { document: { select: { content: true } } },
  });
  if (!session) {
    response.status(404).end();
    return;
  }
  authorizedContentType(response);
  response.status(200).send(Uint8Array.from(session.document.content));
});

euroOfficeRouter.post('/integrations/eurooffice/:documentId/callback', async (request, response) => {
  if (!requireEuroOffice(response)) return;
  const parsedId = documentIdSchema.safeParse(request.params.documentId);
  const parsedBody = callbackSchema.safeParse(request.body);
  const token = typeof request.query.token === 'string' ? request.query.token : '';
  if (!parsedId.success || !parsedBody.success || !token || token.length > 128) {
    response.status(404).json({ error: 1 });
    return;
  }
  const callback = parsedBody.data;
  if (callback.status !== 2 && callback.status !== 6) {
    response.status(200).json({ error: 0 });
    return;
  }
  if (!callback.url || !callback.key) {
    response.status(400).json({ error: 1 });
    return;
  }

  const session = await prisma.euroOfficeSession.findFirst({
    where: { documentId: parsedId.data, tokenHash: tokenDigest(token), expiresAt: { gt: new Date() } },
    select: { documentId: true, userId: true, documentKey: true },
  });
  if (!session || callback.key !== session.documentKey) {
    response.status(404).json({ error: 1 });
    return;
  }

  try {
    const source = new URL(callback.url);
    const expected = new URL(env.EUROOFFICE_URL!);
    if (source.origin !== expected.origin || source.protocol !== 'https:') {
      response.status(400).json({ error: 1 });
      return;
    }
    const fetched = await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
    if (!fetched.ok) throw new Error(`EuroOffice returned HTTP ${fetched.status}.`);
    const declaredSize = Number(fetched.headers.get('content-length') ?? 0);
    if (declaredSize > MAX_DOCX_BYTES) throw new Error('The DOCX file is too large.');
    const bytes = Buffer.from(await fetched.arrayBuffer());
    if (bytes.length > MAX_DOCX_BYTES || bytes.subarray(0, 4).toString('hex') !== '504b0304') {
      throw new Error('EuroOffice did not return a valid DOCX package.');
    }
    await prisma.plainDocument.updateMany({
      where: { id: session.documentId, userId: session.userId },
      data: { content: Uint8Array.from(bytes), revision: { increment: 1 } },
    });
    response.status(200).json({ error: 0 });
  } catch (error) {
    console.error('EuroOffice save callback failed:', error);
    response.status(502).json({ error: 1 });
  }
});
