import { createHash, randomBytes } from 'node:crypto';
import { SignJWT } from 'jose';
import { createBlankDocx } from '../integrations/eurooffice/blankDocx.js';
import { readBoundedDocx } from '../integrations/eurooffice/docxBoundary.js';
import { env } from '../config/env.js';
import { euroOfficeRepository as repository } from '../repositories/euroOfficeRepository.js';

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export class EuroOfficeError extends Error {
  constructor(readonly code: string, readonly status: number) { super(code); }
}
export function requireEuroOffice(): void {
  if (!env.EUROOFFICE_ENABLED) throw new EuroOfficeError('EUROOFFICE_NOT_CONFIGURED', 503);
}
const serialize = <T extends { createdAt: Date; updatedAt: Date }>(document: T) => ({ ...document, createdAt: document.createdAt.toISOString(), updatedAt: document.updatedAt.toISOString() });
export async function listPlainDocuments(userId: string) {
  requireEuroOffice(); return { documents: (await repository.list(userId)).map(serialize) };
}
export async function createPlainDocument(userId: string, title: string) {
  requireEuroOffice(); return { document: serialize(await repository.create(userId, title, createBlankDocx(title))) };
}
export async function createEuroOfficeSession(userId: string, documentId: string, language: string | false, editorType: 'mobile' | 'desktop') {
  requireEuroOffice();
  const document = await repository.owned(documentId, userId);
  if (!document) throw new EuroOfficeError('DOCUMENT_NOT_FOUND', 404);
  const user = await repository.user(userId);
  if (!user) throw new EuroOfficeError('NOT_AUTHENTICATED', 401);
  const token = randomBytes(32).toString('base64url');
  const documentKey = `${document.id}-${document.revision}`;
  const expiresAt = new Date(Date.now() + 8 * 60 * 60 * 1000);
  await repository.session({ documentId, userId, tokenHash: digest(token), documentKey, baseRevision: document.revision, expiresAt });
  const serverUrl = env.EUROOFFICE_URL!;
  const studioUrl = env.FRONTEND_ORIGIN.replace(/\/+$/, '');
  const acceptedLanguage = language;
  const capability = encodeURIComponent(token);
  const contentUrl = `${studioUrl}/api/v1/integrations/eurooffice/${document.id}/content?token=${capability}`;
  const callbackUrl = `${studioUrl}/api/v1/integrations/eurooffice/${document.id}/callback?token=${capability}`;
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
      user: { id: userId, name: user.fullName },
      customization: {
        forcesave: true,
        // Keep the editor header compact on both desktop and mobile layouts.
        compactHeader: true,
      },
    },
    height: '100%',
    width: '100%',
    type: editorType === 'mobile' ? 'mobile' : 'desktop',
  };

  const jwt = await new SignJWT(config)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(Buffer.from(env.EUROOFFICE_JWT_SECRET!));


  return { apiScriptUrl: `${serverUrl}/web-apps/apps/api/documents/api.js`, config: { ...config, token: jwt }, expiresAt: expiresAt.toISOString() };
}
async function capability(documentId: string, token: string) {
  requireEuroOffice();
  const session = await repository.capability(documentId, digest(token));
  if (!session) throw new EuroOfficeError('DOCUMENT_NOT_FOUND', 404);
  return session;
}
export async function euroOfficeContent(documentId: string, token: string) {
  const session = await capability(documentId, token);
  // Never supply newer bytes under an older editor key.
  if (session.document.revision !== session.baseRevision) throw new EuroOfficeError('DOCUMENT_CONFLICT', 409);
  return session.document.content;
}
export async function saveEuroOfficeCallback(documentId: string, token: string, callback: { status: number; key?: string | undefined; url?: string | undefined }) {
  const session = await capability(documentId, token);
  if (callback.key !== session.documentKey) throw new EuroOfficeError('DOCUMENT_NOT_FOUND', 404);
  if (![2, 6].includes(callback.status)) return;
  if (!callback.url) throw new EuroOfficeError('INVALID_CALLBACK', 400);
  const source = new URL(callback.url), expected = new URL(env.EUROOFFICE_URL!);
  if (source.origin !== expected.origin || source.protocol !== 'https:' || source.username || source.password) throw new EuroOfficeError('INVALID_CALLBACK', 400);
  const callbackDigest = digest(JSON.stringify([session.documentKey, callback.status, source.href]));
  if (await repository.receipt(documentId, callbackDigest)) return;
  const bytes = await readBoundedDocx(await fetch(source, { redirect: 'error', signal: AbortSignal.timeout(30_000) }));
  await repository.save({ documentId, userId: session.userId, documentKey: session.documentKey, baseRevision: session.baseRevision, callbackDigest, status: callback.status, bytes });
}
export async function listEuroOfficeSaves(userId: string, documentId: string) {
  requireEuroOffice();
  if (!await repository.owned(documentId, userId)) throw new EuroOfficeError('DOCUMENT_NOT_FOUND', 404);
  return { saves: (await repository.saves(documentId, userId)).map(save => ({ ...save, createdAt: save.createdAt.toISOString() })) };
}
export async function downloadEuroOfficeSave(userId: string, documentId: string, saveId: string) {
  requireEuroOffice();
  const save = await repository.savedContent(saveId, documentId, userId);
  if (!save) throw new EuroOfficeError('DOCUMENT_NOT_FOUND', 404);
  return save.content;
}
