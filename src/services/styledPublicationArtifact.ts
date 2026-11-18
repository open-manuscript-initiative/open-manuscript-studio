import { getDocumentStructureProfile } from '../model/documentProfile';
import {
  resolvePublicationProfile,
  profileSupportsOutput,
} from '../model/publicationProfile';
import { sha256HexSync } from '../model/stateDigest';
import type { OmiManuscript } from '../types/omi';
import { BUILD_INFO } from '../version';
import { applyPdfInteractionMode, pdfFileName } from './exportPdf';
import { createPublicationBuildManifest } from './publicationBuildManifest';
import { publicationHtmlFileName } from './publicationHtmlArtifact';
import {
  renderStyleBasedHtml,
  type PublicationStyle,
  type PublicationPublisherIdentity,
} from './publicationStyleExport';
import type { PreparedPublicationArtifact } from './publicationArtifact';
import { renderPdfArtifact } from './vivliostylePdfApi';

export type StyledPublicationFormat = 'html' | 'pdf-print' | 'pdf-interactive';
export interface PublicationLayoutContext {
  style: PublicationStyle;
  identity: PublicationPublisherIdentity;
}
export function publicationLayoutKey(
  context: PublicationLayoutContext,
): string {
  return sha256HexSync(new TextEncoder().encode(JSON.stringify(context)));
}
export interface StyledPublicationArtifact extends PreparedPublicationArtifact {
  format: StyledPublicationFormat;
  layoutKey: string;
  styleName: string;
}
/** One explicit style snapshot; no local-storage reads after rendering begins. */
export async function prepareStyledPublicationArtifact(
  manuscript: OmiManuscript,
  format: StyledPublicationFormat,
  input: PublicationLayoutContext,
  renderPdf = renderPdfArtifact,
): Promise<StyledPublicationArtifact> {
  if (getDocumentStructureProfile(manuscript).kind !== 'study')
    throw new Error('OJS publication transfer requires a standalone study.');
  const context = structuredClone(input);
  const profile = {
    ...resolvePublicationProfile(manuscript),
    publicationStyle: context.style,
  };
  if (!profileSupportsOutput(profile, format === 'html' ? 'html' : 'pdf'))
    throw new Error(
      'The selected publication profile does not support this output.',
    );
  const isHtml = format === 'html';
  const html = await renderStyleBasedHtml(
    manuscript,
    profile,
    isHtml ? 'html' : 'print',
    { ...context, embedAssets: true },
  );
  const rendererInput = isHtml
    ? html
    : applyPdfInteractionMode(
        html,
        format === 'pdf-interactive' ? 'interactive' : 'print',
        'publication',
      );
  const fileName = isHtml
    ? publicationHtmlFileName(manuscript).replace(/\.html$/i, '.styled.html')
    : pdfFileName(
        manuscript,
        format === 'pdf-interactive' ? 'interactive' : 'print',
      );
  const pdf = isHtml ? null : await renderPdf(rendererInput, fileName);
  const bytes = isHtml
    ? new TextEncoder().encode(html)
    : new Uint8Array(await pdf!.blob.arrayBuffer());
  if (
    !bytes.length ||
    (!isHtml &&
      (new TextDecoder().decode(bytes.subarray(0, 5)) !== '%PDF-' ||
        !new TextDecoder().decode(bytes.subarray(-1024)).includes('%%EOF')))
  )
    throw new Error('The renderer returned an invalid publication artifact.');
  const mediaType = isHtml ? 'text/html;charset=utf-8' : 'application/pdf';
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192)
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return {
    format,
    fileName,
    mediaType,
    bytes,
    artifactBase64: btoa(binary),
    ...(isHtml ? { previewText: html } : {}),
    layoutKey: publicationLayoutKey(context),
    styleName: context.style.name,
    build: createPublicationBuildManifest({
      manuscript,
      profile,
      artifact: bytes,
      rendererInput: {
        value: rendererInput,
        mediaType: 'text/html;charset=utf-8',
      },
      output: { format, fileName, mediaType },
      generator: {
        applicationVersion: BUILD_INFO.version,
        renderer: pdf?.renderer ?? 'open-manuscript-studio-live-html',
        rendererVersion: pdf?.rendererVersion ?? '0.1.0',
      },
    }),
  };
}
