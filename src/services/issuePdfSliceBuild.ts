import type { OmiManuscript } from '../types/omi';
import type { OmiPublicationBuild } from '../model/publicationBuild';
import type { OmiPublicationProfile } from '../model/publicationProfile';
import { createPublicationBuildManifest } from './publicationBuildManifest';

export interface IssuePdfSliceDerivation {
  protocol: 'omi-issue-pdf-slice/1';
  parentBuildId: string;
  parentPdfSha256: string;
  rootSectionId: string;
  firstPhysicalPage: number;
  lastPhysicalPage: number;
  layoutKey: string;
}
export function buildIssuePdfSlice(input: {
  source: OmiManuscript; profile: OmiPublicationProfile; parentBuild: OmiPublicationBuild;
  layoutKey: string; rootSectionId: string; firstPage: number; lastPage: number; pageCount: number;
  bytes: Uint8Array; fileName: string; applicationVersion: string;
}) {
  const parent = input.parentBuild;
  if (parent.output.format !== 'pdf-print' || parent.manuscript.id !== input.source.id ||
      parent.manuscript.revisionId !== input.source.headRevisionId ||
      !input.rootSectionId || !input.source.sections.some(section => section.id === input.rootSectionId) ||
      !/^[a-f0-9]{64}$/.test(input.layoutKey) ||
      !Number.isSafeInteger(input.pageCount) || input.pageCount > 2000 ||
      !Number.isSafeInteger(input.firstPage) || !Number.isSafeInteger(input.lastPage) ||
      input.firstPage < 1 || input.lastPage < input.firstPage || input.lastPage > input.pageCount ||
      new TextDecoder().decode(input.bytes.subarray(0, 5)) !== '%PDF-' ||
      !new TextDecoder().decode(input.bytes.subarray(-1024)).includes('%%EOF')) {
    throw new Error('Invalid study PDF derivation.');
  }
  const derivation: IssuePdfSliceDerivation = {
    protocol: 'omi-issue-pdf-slice/1', parentBuildId: parent.id, parentPdfSha256: parent.output.digest.value,
    rootSectionId: input.rootSectionId, firstPhysicalPage: input.firstPage, lastPhysicalPage: input.lastPage,
    layoutKey: input.layoutKey,
  };
  // The existing build format fingerprints the exact extraction instruction.
  // Keep that instruction separately available for audit; do not claim the
  // article was rendered independently or invent a qpdf executable version.
  const derivationText = JSON.stringify(derivation);
  const build = createPublicationBuildManifest({
    manuscript: input.source, profile: input.profile, artifact: input.bytes,
    rendererInput: { value: derivationText, mediaType: 'application/json' },
    output: { format: 'pdf-print', mediaType: 'application/pdf', fileName: input.fileName },
    generator: { applicationVersion: input.applicationVersion, renderer: 'open-manuscript-studio-issue-pdf-slice', rendererVersion: '1' },
  });
  if (build.profile.digest.value !== parent.profile.digest.value ||
      build.manuscript.stateDigest.value !== parent.manuscript.stateDigest.value) throw new Error('Issue build snapshot changed.');
  return { build, derivation, derivationText };
}
