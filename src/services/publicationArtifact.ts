import type { OmiPublicationBuild } from '../model/publicationBuild';
import { getDocumentStructureProfile } from '../model/documentProfile';
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
import {
  buildPublicationHtmlArtifact,
  publicationHtmlFileName,
  OMI_HTML_PUBLICATION_RENDERER_VERSION,
} from './publicationHtmlArtifact';
import { validateJats4rProfile } from './jats4rProfileValidator';
import {
  evaluateJatsPublicationRelease,
  jatsPublicationReleaseFailureMessage,
} from './jatsReleaseGate';
import { validateJatsSchema } from './jatsValidationApi';
import { createPublicationBuildManifest } from './publicationBuildManifest';
import { renderPdfArtifact } from './vivliostylePdfApi';

export type PublicationArtifactProvider = 'ojs' | 'omp';

export type PublicationArtifactFormat =
  | 'html'
  | 'jats'
  | 'pdf-print'
  | 'pdf-interactive';

export interface PublicationArtifactFormatCapability {
  id: PublicationArtifactFormat;
  label: string;
  mediaType: string;
  extension: string;
  maxBytes: number;
  available: boolean;
  requires: string | null;
}

export interface PublicationArtifactAuthority {
  representation?: 'galley' | 'publicationFormat';
  formatApprovedByDefault?: boolean;
  formatAvailableByDefault?: boolean;
  proofViewableByDefault?: boolean;
}

export interface PublicationArtifactTarget {
  protocol: 'omi-publication-artifact/1';
  submissionId: number;
  publicationId: number;
  title: string;
  locales: string[];
  genres: { id: number; label: string }[];
  formats: PublicationArtifactFormatCapability[];
  provenance: {
    required: true;
    model: 'omi-publication-build';
    version: '0.1.0';
    digest: 'sha256';
  };
  authority?: PublicationArtifactAuthority;
  published: false;
}

export interface PublicationArtifactReceipt {
  protocol: 'omi-publication-artifact/1';
  submissionId: number;
  publicationId: number;
  format: PublicationArtifactFormat;
  mediaType: string;
  artifactFileName: string;
  galleyId?: number;
  publicationFormatId?: number;
  submissionFileId: number;
  sha256: string;
  buildId: string;
  provenanceVerified: true;
  unchanged: boolean;
  formatApproved?: boolean;
  formatAvailable?: boolean;
  proofViewable?: boolean;
  published: false;
}

export type PublicationArtifactRequest = {
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
      format: PublicationArtifactFormat;
      mediaType: string;
      fileName: string;
      artifactBase64: string;
      build: OmiPublicationBuild;
      confirmed: true;
    }
);

export interface PreparedPublicationArtifact {
  format: PublicationArtifactFormat;
  mediaType: string;
  fileName: string;
  bytes: Uint8Array;
  artifactBase64: string;
  build: OmiPublicationBuild;
  previewText?: string;
}

export function publicationArtifactFormatAvailableForDocument(
  manuscript: OmiManuscript,
  format: PublicationArtifactFormat,
): boolean {
  if (getDocumentStructureProfile(manuscript).kind === 'study') return true;
  return format === 'pdf-print' || format === 'pdf-interactive';
}

export async function preparePublicationArtifact(
  manuscript: OmiManuscript,
  format: PublicationArtifactFormat,
): Promise<PreparedPublicationArtifact> {
  if (!publicationArtifactFormatAvailableForDocument(manuscript, format)) {
    throw new Error(
      'HTML and JATS publication-artifact transfer currently require a standalone study. Use print or interactive PDF for an OMI volume.',
    );
  }

  const profile = resolvePublicationProfile(manuscript);

  if (format === 'html') {
    const html = await buildPublicationHtmlArtifact(manuscript, profile);
    const bytes = new TextEncoder().encode(html);
    const fileName = publicationHtmlFileName(manuscript);
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
        renderer: 'open-manuscript-studio-html-publication',
        rendererVersion: OMI_HTML_PUBLICATION_RENDERER_VERSION,
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
    assertJatsDirectTransferHasNoPackageLocalAssets(rendered.xml);

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

export function assertJatsDirectTransferHasNoPackageLocalAssets(xml: string): void {
  for (const match of xml.matchAll(
    /<(?:graphic|media)\b[^>]*\bxlink:href="([^"]+)"/gi,
  )) {
    const href = (match[1] ?? '').trim();
    if (href && !/^(?:https?:|mailto:|#)/i.test(href)) {
      throw new Error(
        'JATS direct transfer cannot yet carry package-local binary assets. Export a self-contained HTML/PDF artifact or remove the local JATS media dependency.',
      );
    }
  }
}

function createBuild(input: {
  manuscript: OmiManuscript;
  profile: ReturnType<typeof resolvePublicationProfile>;
  bytes: Uint8Array;
  format: PublicationArtifactFormat;
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
