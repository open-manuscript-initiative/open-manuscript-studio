import type { OmiPublicationBuild } from '../model/publicationBuild';
import { resolvePublicationProfile } from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { BUILD_INFO } from '../version';
import {
  buildPdfArtifactDocument,
  pdfFileName,
  type PdfExportMode,
} from './exportPdf';
import {
  jatsFileName,
  OMI_JATS_RENDERER_VERSION,
  renderJatsArticle,
} from './exportJats';
import { buildHtmlGalley, htmlGalleyFileName, OMI_HTML_GALLEY_RENDERER_VERSION } from './htmlGalley';
import { validateJats4rProfile } from './jats4rProfileValidator';
import {
  evaluateJatsPublicationRelease,
  jatsPublicationReleaseFailureMessage,
} from './jatsReleaseGate';
import { validateJatsSchema } from './jatsValidationApi';
import { createPublicationBuildManifest } from './publicationBuildManifest';
import { renderPdfArtifact } from './vivliostylePdfApi';

export type OjsPublicationArtifactFormat =
  | 'html'
  | 'jats'
  | 'pdf-print'
  | 'pdf-interactive';

export interface OjsPublicationArtifactFormatCapability {
  id: OjsPublicationArtifactFormat;
  label: string;
  mediaType: string;
  extension: string;
  maxBytes: number;
  available: boolean;
  requires: string | null;
}

export interface OjsPublicationArtifactTarget {
  protocol: 'omi-publication-artifact/1';
  submissionId: number;
  publicationId: number;
  title: string;
  locales: string[];
  genres: { id: number; label: string }[];
  formats: OjsPublicationArtifactFormatCapability[];
  provenance: {
    required: true;
    model: 'omi-publication-build';
    version: '0.1.0';
    digest: 'sha256';
  };
  published: false;
}

export interface OjsPublicationArtifactReceipt {
  protocol: 'omi-publication-artifact/1';
  submissionId: number;
  publicationId: number;
  format: OjsPublicationArtifactFormat;
  mediaType: string;
  artifactFileName: string;
  galleyId: number;
  submissionFileId: number;
  sha256: string;
  buildId: string;
  provenanceVerified: true;
  unchanged: boolean;
  published: false;
}

export type OjsPublicationArtifactRequest = {
  manuscriptId: string;
  submissionId: number;
} & (
  | {
      action: 'inspect';
    }
  | {
      action: 'transfer';
      publicationId: number;
      locale: string;
      genreId: number;
      format: OjsPublicationArtifactFormat;
      mediaType: string;
      fileName: string;
      artifactBase64: string;
      build: OmiPublicationBuild;
      confirmed: true;
    }
);

export interface PreparedOjsPublicationArtifact {
  format: OjsPublicationArtifactFormat;
  mediaType: string;
  fileName: string;
  bytes: Uint8Array;
  artifactBase64: string;
  build: OmiPublicationBuild;
  previewText?: string;
}

export async function prepareOjsPublicationArtifact(
  manuscript: OmiManuscript,
  format: OjsPublicationArtifactFormat,
): Promise<PreparedOjsPublicationArtifact> {
  const profile = resolvePublicationProfile(manuscript);

  if (format === 'html') {
    const html = await buildHtmlGalley(manuscript, profile);
    const bytes = new TextEncoder().encode(html);
    const fileName = htmlGalleyFileName(manuscript);
    const mediaType = 'text/html;charset=utf-8';
    return {
      format,
      mediaType,
      fileName,
      bytes,
      artifactBase64: bytesToBase64(bytes),
      build: createBuild({
        manuscript,
        profile,
        bytes,
        format,
        mediaType,
        fileName,
        renderer: 'open-manuscript-studio-html-galley',
        rendererVersion: OMI_HTML_GALLEY_RENDERER_VERSION,
      }),
      previewText: html,
    };
  }

  if (format === 'jats') {
    const rendered = renderJatsArticle(manuscript, profile);
    const validation = await validateJatsSchema(rendered.xml);
    const jats4r = validateJats4rProfile(rendered.xml);
    const release = evaluateJatsPublicationRelease(
      rendered,
      validation,
      jats4r,
    );
    if (!release.releasable) {
      throw new Error(jatsPublicationReleaseFailureMessage(release));
    }

    const bytes = new TextEncoder().encode(rendered.xml);
    const fileName = jatsFileName(manuscript);
    const mediaType = 'application/xml';
    return {
      format,
      mediaType,
      fileName,
      bytes,
      artifactBase64: bytesToBase64(bytes),
      build: createBuild({
        manuscript,
        profile,
        bytes,
        format,
        mediaType,
        fileName,
        renderer: 'open-manuscript-studio-jats',
        rendererVersion: OMI_JATS_RENDERER_VERSION,
      }),
      previewText: rendered.xml,
    };
  }

  const pdfMode: PdfExportMode =
    format === 'pdf-interactive' ? 'interactive' : 'print';
  const rendererInput = await buildPdfArtifactDocument(
    manuscript,
    profile,
    pdfMode,
    'publication',
  );
  const fileName = pdfFileName(manuscript, pdfMode);
  const rendered = await renderPdfArtifact(rendererInput, fileName);
  const bytes = new Uint8Array(await rendered.blob.arrayBuffer());
  const mediaType = 'application/pdf';

  return {
    format,
    mediaType,
    fileName,
    bytes,
    artifactBase64: bytesToBase64(bytes),
    build: createBuild({
      manuscript,
      profile,
      bytes,
      format,
      mediaType,
      fileName,
      renderer: rendered.renderer,
      rendererVersion: rendered.rendererVersion,
      rendererInput: {
        value: rendererInput,
        mediaType: 'text/html;charset=utf-8',
      },
    }),
  };
}

function createBuild(input: {
  manuscript: OmiManuscript;
  profile: ReturnType<typeof resolvePublicationProfile>;
  bytes: Uint8Array;
  format: OjsPublicationArtifactFormat;
  mediaType: string;
  fileName: string;
  renderer: string;
  rendererVersion: string;
  rendererInput?: {
    value: string | Uint8Array;
    mediaType: string;
  };
}): OmiPublicationBuild {
  return createPublicationBuildManifest({
    manuscript: input.manuscript,
    profile: input.profile,
    artifact: input.bytes,
    rendererInput: input.rendererInput,
    output: {
      format: input.format,
      mediaType: input.mediaType,
      fileName: input.fileName,
    },
    generator: {
      applicationVersion: BUILD_INFO.version,
      applicationBuild: optionalBuildValue(BUILD_INFO.build, '0'),
      applicationCommit: optionalBuildValue(BUILD_INFO.commit, '-'),
      renderer: input.renderer,
      rendererVersion: input.rendererVersion,
    },
  });
}

function optionalBuildValue(
  value: string,
  placeholder: string,
): string | undefined {
  const normalized = value.trim();
  return normalized && normalized !== placeholder ? normalized : undefined;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}
