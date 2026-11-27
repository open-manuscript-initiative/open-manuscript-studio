import type { OmpChapterTransferTarget } from './ompChapterTransferTargets';

export type OmpChapterPageIdentity = Pick<OmpChapterTransferTarget, 'installationId' | 'contextId' | 'chapterId' | 'submissionId' | 'publicationId'>;
import { printedPageLabel, type PrintedPageRange } from './ojsIssuePrintedPages';
export type { PrintedPageRange } from './ojsIssuePrintedPages';
export type OmpChapterPageRequest = OmpChapterPageIdentity & ({ action: 'inspect' } |
  ({ action: 'apply'; confirmed: true; expectedWorkflowToken: string } & PrintedPageRange));
export interface OmpChapterPageSnapshot extends OmpChapterPageIdentity {
  protocol: 'omi-chapter-page-range/1'; sourceChapterId: number | null; pages: string | null; workflowToken: string; published: false;
}
export interface OmpChapterPageReceipt extends OmpChapterPageIdentity {
  protocol: 'omi-chapter-page-range/1'; previousPages: string | null; pages: string;
  previousWorkflowToken: string; workflowToken: string; unchanged: boolean; published: false;
}
export interface OmpChapterPageResponse { snapshot: OmpChapterPageSnapshot; receipt?: OmpChapterPageReceipt }

export function pageIdentity(target: OmpChapterTransferTarget): OmpChapterPageIdentity {
  return { installationId: target.installationId, contextId: target.contextId, chapterId: target.chapterId,
    submissionId: target.submissionId, publicationId: target.publicationId };
}
export function assertPageSnapshot(target: OmpChapterTransferTarget, snapshot: OmpChapterPageSnapshot): void {
  if (!snapshot || snapshot.protocol !== 'omi-chapter-page-range/1' || snapshot.published !== false ||
      Object.entries(pageIdentity(target)).some(([key, value]) => snapshot[key as keyof OmpChapterPageIdentity] !== value) ||
      snapshot.sourceChapterId !== target.sourceChapterId || !/^[a-f0-9]{64}$/.test(snapshot.workflowToken) || (snapshot.pages !== null && typeof snapshot.pages !== 'string')) {
    throw new Error('The OMP page destination changed or is unsupported.');
  }
}
export function prepareChapterPageWrite(target: OmpChapterTransferTarget, snapshot: OmpChapterPageSnapshot,
  range: PrintedPageRange, confirmed: true): OmpChapterPageRequest {
  assertPageSnapshot(target, snapshot);
  printedPageLabel(range);
  if (confirmed !== true) throw new Error('Confirm the printed page range before writing.');
  return { ...pageIdentity(target), action: 'apply', firstPrintedPage: range.firstPrintedPage,
    lastPrintedPage: range.lastPrintedPage, expectedWorkflowToken: snapshot.workflowToken, confirmed };
}

/** A reviewed batch must belong to one chapter and allow adjacent chapters to share one boundary page. */
export function validatePrintedChapterRanges(targets: readonly OmpChapterTransferTarget[],
  ranges: readonly (PrintedPageRange & { rootSectionId: string })[]): void {
  if (!targets.length || targets.length !== ranges.length || new Set(targets.map(t => t.rootSectionId)).size !== targets.length ||
    new Set(targets.map(t => t.chapterId)).size !== targets.length) throw new Error('Review every distinct OMP chapter.');
  const first = targets[0]!;
  let previous = 0;
  targets.forEach((target, i) => {
    const range = ranges[i]!;
    if (target.installationId !== first.installationId || target.contextId !== first.contextId || target.submissionId !== first.submissionId || target.publicationId !== first.publicationId ||
        target.rootSectionId !== range.rootSectionId) throw new Error('Mixed or reordered OMP chapter targets.');
    printedPageLabel(range);
    if (range.firstPrintedPage < previous) throw new Error('Printed chapter ranges are out of order or overlap by more than one page.');
    previous = range.lastPrintedPage;
  });
}
