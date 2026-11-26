import type { OjsIssueTransferTarget } from './ojsIssueTransferTargets';

export type OjsIssuePageIdentity = Pick<OjsIssueTransferTarget, 'installationId' | 'contextId' | 'issueId' | 'submissionId' | 'publicationId'>;
export interface PrintedPageRange { firstPrintedPage: number; lastPrintedPage: number }
export type OjsIssuePageRequest = OjsIssuePageIdentity & ({ action: 'inspect' } |
  ({ action: 'apply'; confirmed: true; expectedWorkflowToken: string } & PrintedPageRange));
export interface OjsIssuePageSnapshot extends OjsIssuePageIdentity {
  protocol: 'omi-issue-page-range/1'; pages: string | null; workflowToken: string; published: false;
}
export interface OjsIssuePageReceipt extends OjsIssuePageIdentity {
  protocol: 'omi-issue-page-range/1'; previousPages: string | null; pages: string;
  previousWorkflowToken: string; workflowToken: string; unchanged: boolean; published: false;
}
export interface OjsIssuePageResponse { snapshot: OjsIssuePageSnapshot; receipt?: OjsIssuePageReceipt }

export function printedPageLabel(range: PrintedPageRange): string {
  const { firstPrintedPage: first, lastPrintedPage: last } = range;
  if (!Number.isSafeInteger(first) || !Number.isSafeInteger(last) || first < 1 || last < first || last > 999999) {
    throw new Error('Enter a valid printed page range.');
  }
  return first === last ? String(first) : first + '-' + last;
}
export function pageIdentity(target: OjsIssueTransferTarget): OjsIssuePageIdentity {
  return { installationId: target.installationId, contextId: target.contextId, issueId: target.issueId,
    submissionId: target.submissionId, publicationId: target.publicationId };
}
export function assertPageSnapshot(target: OjsIssueTransferTarget, snapshot: OjsIssuePageSnapshot): void {
  if (!snapshot || snapshot.protocol !== 'omi-issue-page-range/1' || snapshot.published !== false ||
      Object.entries(pageIdentity(target)).some(([key, value]) => snapshot[key as keyof OjsIssuePageIdentity] !== value) ||
      !/^[a-f0-9]{64}$/.test(snapshot.workflowToken) || (snapshot.pages !== null && typeof snapshot.pages !== 'string')) {
    throw new Error('The OJS page destination changed or is unsupported.');
  }
}
export function prepareIssuePageWrite(target: OjsIssueTransferTarget, snapshot: OjsIssuePageSnapshot,
  range: PrintedPageRange, confirmed: true): OjsIssuePageRequest {
  assertPageSnapshot(target, snapshot);
  printedPageLabel(range);
  if (confirmed !== true) throw new Error('Confirm the printed page range before writing.');
  return { ...pageIdentity(target), action: 'apply', firstPrintedPage: range.firstPrintedPage,
    lastPrintedPage: range.lastPrintedPage, expectedWorkflowToken: snapshot.workflowToken, confirmed };
}

/** A reviewed batch must belong to one issue and preserve exclusive printed ranges. */
export function validatePrintedIssueRanges(targets: readonly OjsIssueTransferTarget[],
  ranges: readonly (PrintedPageRange & { rootSectionId: string })[]): void {
  if (!targets.length || targets.length !== ranges.length || new Set(targets.map(t => t.rootSectionId)).size !== targets.length ||
    new Set(targets.map(t => t.submissionId)).size !== targets.length) throw new Error('Review every distinct OJS article.');
  const first = targets[0]!;
  let previous = 0;
  targets.forEach((target, i) => {
    const range = ranges[i]!;
    if (target.installationId !== first.installationId || target.contextId !== first.contextId || target.issueId !== first.issueId ||
        target.rootSectionId !== range.rootSectionId) throw new Error('Mixed or reordered OJS issue targets.');
    printedPageLabel(range);
    if (range.firstPrintedPage <= previous) throw new Error('Printed page ranges overlap or are out of order.');
    previous = range.lastPrintedPage;
  });
}
