import type { OmiPublicationBuild } from '../model/publicationBuild';
import { resolvePublicationProfile, type OmiPublicationProfile } from '../model/publicationProfile';
import { createPublicationBuildManifest } from './publicationBuildManifest';
import { buildIssuePdfSlice, type IssuePdfSliceDerivation } from './issuePdfSliceBuild';
import { BUILD_INFO } from '../version';
import type { OmiManuscript } from '../types/omi';
import { getDocumentStructureProfile } from '../model/documentProfile';
import { partitionManuscriptStudies } from '../model/sectionStructure';
import { normalizeIssuePdfText, proposeIssuePdfRanges, validateReviewedIssueRanges, type IssuePdfStudyAnchors, type IssuePdfRangeProposal } from '../model/issuePdfPageRanges';
import { applyPdfInteractionMode, pdfFileName } from './exportPdf';
import { renderStyleBasedHtml } from './publicationStyleExport';
import { publicationLayoutKey, type PublicationLayoutContext } from './styledPublicationArtifact';
import { inspectRenderedIssuePages, renderPdfArtifact, sliceRenderedIssuePdf } from './vivliostylePdfApi';

export interface IssuePdfRangePlan {
  readonly pdf: Blob;
  readonly parentBuild: OmiPublicationBuild;
  readonly profile: OmiPublicationProfile;
  readonly source: OmiManuscript;
  readonly layoutKey: string;
  readonly renderer: string;
  readonly rendererVersion: string;
  readonly pageCount: number;
  readonly proposals: readonly IssuePdfRangeProposal[];
}

function anchorTail(text: string): string {
  return normalizeIssuePdfText(text).split(' ').slice(-12).join(' ');
}

/** Derive textual evidence from the exact semantic HTML used for rendering. */
export function extractIssueStudyAnchors(html: string, source: OmiManuscript): IssuePdfStudyAnchors[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const elements = new Map<string, Element[]>();
  for (const element of document.querySelectorAll('section[data-omi-section-id]')) {
    const id = element.getAttribute('data-omi-section-id')!;
    elements.set(id, [...(elements.get(id) ?? []), element]);
  }
  return partitionManuscriptStudies(source.sections).map(study => {
    const title = study.sections.find(section => section.id === study.rootSectionId)?.title ?? '';
    const roots = elements.get(study.rootSectionId) ?? [];
    if (roots.length !== 1) return { rootSectionId: study.rootSectionId, title, startText: '', endText: '' };
    const root = roots[0]!;
    const heading = root.querySelector(':scope > :is(h2,h3,h4,h5,h6) .section-title');
    const blocks = [...root.querySelectorAll('[data-omi-block-id]')];
    const last = blocks.at(-1);
    // Do not pretend a final figure, table or empty heading establishes the
    // last page. Notes/references outside the root always require visual review.
    const textual = last && last.matches('p,blockquote,div') &&
      !last.querySelector('figure,table,img,svg,math') && !last.matches('figure,table');
    return { rootSectionId: study.rootSectionId, title,
      startText: heading?.textContent ?? '',
      endText: textual ? anchorTail(last.textContent ?? '') : '' };
  });
}

/** Render once. The same immutable PDF blob is inspected and later sliced. */
export async function prepareIssuePdfRangePlan(
  source: OmiManuscript, context: PublicationLayoutContext,
): Promise<IssuePdfRangePlan> {
  if (getDocumentStructureProfile(source).kind !== 'volume') throw new Error('Select an edited volume or journal issue.');
  const snapshot = structuredClone(context);
  const profile = { ...resolvePublicationProfile(source), publicationStyle: snapshot.style };
  const html = await renderStyleBasedHtml(source, profile, 'print', { ...snapshot, embedAssets: true });
  const rendererInput = applyPdfInteractionMode(html, 'print', 'publication');
  const anchors = extractIssueStudyAnchors(rendererInput, source);
  if (!anchors.length) throw new Error('No studies to export.');
  const rendered = await renderPdfArtifact(rendererInput, pdfFileName(source, 'print'));
  const pages = await inspectRenderedIssuePages(rendered.blob);
  const parentBuild = createPublicationBuildManifest({
    manuscript: source, profile, artifact: new Uint8Array(await rendered.blob.arrayBuffer()),
    rendererInput: { value: rendererInput, mediaType: 'text/html;charset=utf-8' },
    output: { format: 'pdf-print', mediaType: 'application/pdf', fileName: pdfFileName(source, 'print') },
    generator: { applicationVersion: BUILD_INFO.version, renderer: rendered.renderer, rendererVersion: rendered.rendererVersion },
  });
  return { pdf: rendered.blob, parentBuild, profile, source, layoutKey: publicationLayoutKey(snapshot),
    renderer: rendered.renderer, rendererVersion: rendered.rendererVersion,
    pageCount: pages.length, proposals: proposeIssuePdfRanges(pages, anchors) };
}

export interface ReviewedIssuePdfArtifact {
  rootSectionId: string;
  pdf: Blob;
  fileName: string;
  build: OmiPublicationBuild;
  derivation: IssuePdfSliceDerivation;
  derivationText: string;
}

export async function extractReviewedIssuePdfRanges(
  plan: IssuePdfRangePlan,
  ranges: readonly { rootSectionId: string; firstPage: number; lastPage: number }[],
  options: { confirmed: true; currentSource: () => OmiManuscript; currentLayoutKey: () => string },
): Promise<ReviewedIssuePdfArtifact[]> {
  const assertCurrent = () => {
    if (options.confirmed !== true || options.currentSource() !== plan.source || options.currentLayoutKey() !== plan.layoutKey) {
      throw new Error('Confirm the ranges for the current unchanged issue and layout.');
    }
  };
  assertCurrent();
  validateReviewedIssueRanges(plan.pageCount, plan.proposals.map(item => item.rootSectionId), ranges);
  const result: ReviewedIssuePdfArtifact[] = [];
  for (const range of ranges) {
    assertCurrent();
    const pdf = await sliceRenderedIssuePdf(plan.pdf, range.firstPage, range.lastPage);
    assertCurrent();
    const fileName = `study-${result.length + 1}.pdf`;
    const evidence = buildIssuePdfSlice({
      source: plan.source, profile: plan.profile, parentBuild: plan.parentBuild, layoutKey: plan.layoutKey,
      rootSectionId: range.rootSectionId, firstPage: range.firstPage, lastPage: range.lastPage,
      pageCount: plan.pageCount, bytes: new Uint8Array(await pdf.arrayBuffer()), fileName,
      applicationVersion: BUILD_INFO.version,
    });
    assertCurrent();
    result.push({ rootSectionId: range.rootSectionId, pdf, fileName, ...evidence });
  }
  return result;
}
