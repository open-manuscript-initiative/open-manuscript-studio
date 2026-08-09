import { randomBytes } from 'node:crypto';

import { Router } from 'express';

import { loadOjsLaunchData } from '../integrations/ojs/ojsClient.js';
import { verifyOjsLaunch } from '../integrations/ojs/launchVerifier.js';

export const integrationRouter = Router();

function escapeJsonForHtml(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

interface SourceDocumentDiagnostics {
  present: boolean;
  kind: string | null;
  fileName: string | null;
  paragraphs: number;
  paragraphsWithNoteReferences: number;
  footnoteReferences: number;
  endnoteReferences: number;
  footnotes: number;
  endnotes: number;
  footnotesWithBody: number;
  endnotesWithBody: number;
}

function summarizeSourceDocument(source: unknown): SourceDocumentDiagnostics {
  const empty: SourceDocumentDiagnostics = {
    present: false,
    kind: null,
    fileName: null,
    paragraphs: 0,
    paragraphsWithNoteReferences: 0,
    footnoteReferences: 0,
    endnoteReferences: 0,
    footnotes: 0,
    endnotes: 0,
    footnotesWithBody: 0,
    endnotesWithBody: 0,
  };

  if (!source || typeof source !== 'object') return empty;

  const document = source as Record<string, unknown>;
  const paragraphs = Array.isArray(document.paragraphs) ? document.paragraphs : [];
  const footnotes = Array.isArray(document.footnotes) ? document.footnotes : [];
  const endnotes = Array.isArray(document.endnotes) ? document.endnotes : [];

  let paragraphsWithNoteReferences = 0;
  let footnoteReferences = 0;
  let endnoteReferences = 0;

  for (const paragraph of paragraphs) {
    if (!paragraph || typeof paragraph !== 'object') continue;
    const inline = Array.isArray((paragraph as Record<string, unknown>).inline)
      ? (paragraph as Record<string, unknown>).inline as unknown[]
      : [];

    let paragraphHasNote = false;
    for (const item of inline) {
      if (!item || typeof item !== 'object') continue;
      const kind = (item as Record<string, unknown>).kind;
      if (kind === 'footnoteReference') {
        footnoteReferences += 1;
        paragraphHasNote = true;
      } else if (kind === 'endnoteReference') {
        endnoteReferences += 1;
        paragraphHasNote = true;
      }
    }
    if (paragraphHasNote) paragraphsWithNoteReferences += 1;
  }

  const countBodies = (notes: unknown[]): number =>
    notes.filter((note) => {
      if (!note || typeof note !== 'object') return false;
      const body = (note as Record<string, unknown>).text;
      return typeof body === 'string' && body.trim().length > 0;
    }).length;

  return {
    present: true,
    kind: typeof document.kind === 'string' ? document.kind : null,
    fileName: typeof document.fileName === 'string' ? document.fileName : null,
    paragraphs: paragraphs.length,
    paragraphsWithNoteReferences,
    footnoteReferences,
    endnoteReferences,
    footnotes: footnotes.length,
    endnotes: endnotes.length,
    footnotesWithBody: countBodies(footnotes),
    endnotesWithBody: countBodies(endnotes),
  };
}

integrationRouter.get(
  '/ojs/launch',
  async (request, response) => {
    const payload =
      typeof request.query.payload === 'string'
        ? request.query.payload
        : '';

    const signature =
      typeof request.query.signature === 'string'
        ? request.query.signature
        : '';

    if (!payload || !signature) {
      response.status(400).json({
        error: {
          code: 'MISSING_LAUNCH_ASSERTION',
          message:
            'The launch payload and signature are required.',
        },
      });
      return;
    }

    try {
      const verified = await verifyOjsLaunch(
        payload,
        signature,
      );

      const ojsData = await loadOjsLaunchData(
        verified.claims,
        payload,
        signature,
      );

      const sourceDiagnostics = summarizeSourceDocument(ojsData.sourceDocument);
      console.info('[OMI OJS import] source document loaded', sourceDiagnostics);

      const launchData = {
        protocol: 'omi-integration/1',
        profile: 'omi-integration/1/ojs',
        status: 'verified',
        installation: verified.installation,
        context:
          verified.claims.context ?? null,
        submission: ojsData.submission,
        contributors: ojsData.contributors,
        files: ojsData.files,
        sourceDocument: ojsData.sourceDocument,
        actor:
          verified.claims.actor ?? null,
        scope: verified.claims.scope ?? [],
        expiresAt: new Date(
          verified.claims.exp * 1000,
        ).toISOString(),
      };

      const handoffDiagnostics = summarizeSourceDocument(launchData.sourceDocument);
      console.info('[OMI OJS import] launch payload prepared', handoffDiagnostics);

      const nonce = randomBytes(18).toString('base64');
      const serialized = escapeJsonForHtml(launchData);

      response.setHeader(
        'Content-Security-Policy',
        `default-src 'none'; script-src 'nonce-${nonce}'; base-uri 'none'; frame-ancestors 'none'`,
      );
      response.setHeader(
        'Cache-Control',
        'no-store, max-age=0',
      );
      response.status(200).type('html').send(
        `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Opening Open Manuscript Studio</title>
</head>
<body>
<p>Opening Open Manuscript Studio…</p>
<script nonce="${nonce}">
try {
  sessionStorage.setItem('omi:ojs-launch', ${JSON.stringify(serialized)});
  window.location.replace('/?omiOjsLaunch=1');
} catch (error) {
  document.body.textContent = 'Unable to hand the OJS submission to Open Manuscript Studio.';
}
</script>
</body>
</html>`,
      );
    } catch (error) {
      response.status(401).json({
        error: {
          code: 'INVALID_LAUNCH_ASSERTION',
          message:
            error instanceof Error
              ? error.message
              : 'Launch verification failed.',
        },
      });
    }
  },
);
