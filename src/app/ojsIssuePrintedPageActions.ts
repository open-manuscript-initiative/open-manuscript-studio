import type { OjsIssueTransferTarget } from '../model/ojsIssueTransferTargets';
import { assertPageSnapshot, printedPageLabel, validatePrintedIssueRanges, type PrintedPageRange, type OjsIssuePageSnapshot, type OjsIssuePageReceipt } from '../model/ojsIssuePrintedPages';

export interface PrintedPageReviewRow {
  target: OjsIssueTransferTarget;
  snapshot: OjsIssuePageSnapshot;
  first: string;
  last: string;
  reviewed: boolean;
}
export function createPrintedPageReviewRow(target: OjsIssueTransferTarget, snapshot: OjsIssuePageSnapshot): PrintedPageReviewRow {
  assertPageSnapshot(target, snapshot);
  const match = /^(\d{1,6})(?:\s*[-–]\s*(\d{1,6}))?$/.exec(snapshot.pages?.trim() ?? '');
  return { target, snapshot, first: match?.[1] ?? '', last: match?.[2] ?? match?.[1] ?? '', reviewed: false };
}
export function reviewedPrintedPageRanges(rows: readonly PrintedPageReviewRow[]) {
  const ranges = rows.map(row => {
    if (!row.reviewed || !/^[1-9][0-9]{0,5}$/.test(row.first) || !/^[1-9][0-9]{0,5}$/.test(row.last)) {
      throw new Error('Confirm every valid printed page range.');
    }
    assertPageSnapshot(row.target, row.snapshot);
    return { rootSectionId: row.target.rootSectionId, firstPrintedPage: Number(row.first), lastPrintedPage: Number(row.last) };
  });
  validatePrintedIssueRanges(rows.map(row => row.target), ranges);
  return ranges;
}
export interface PrintedPageBatchResult {
  receipts: { rootSectionId: string; receipt: OjsIssuePageReceipt }[];
  failed?: { rootSectionId: string; title: string; outcome: 'not-sent' | 'unconfirmed'; message: string };
}
/** Preflight every original token before changing any article. Never auto-refresh or replay. */
export function preparePrintedPageBatch(input: {
  rows: readonly PrintedPageReviewRow[];
  assertCurrent: () => void;
  inspect: (target: OjsIssueTransferTarget) => Promise<OjsIssuePageSnapshot>;
  apply: (target: OjsIssueTransferTarget, snapshot: OjsIssuePageSnapshot, range: PrintedPageRange, confirmed: true) => Promise<OjsIssuePageReceipt>;
}) {
  input.assertCurrent();
  const rows = structuredClone([...input.rows]);
  const ranges = reviewedPrintedPageRanges(rows);
  let attempted = false;
  return {
    async execute(confirmed: true): Promise<PrintedPageBatchResult> {
      if (confirmed !== true || attempted) throw new Error('Confirm a fresh printed page batch; do not replay an attempted batch.');
      attempted = true;
      for (const row of rows) {
        input.assertCurrent();
        const current = await input.inspect(row.target);
        input.assertCurrent();
        assertPageSnapshot(row.target, current);
        if (current.workflowToken !== row.snapshot.workflowToken || current.pages !== row.snapshot.pages) {
          throw new Error('OJS page metadata changed. Inspect again.');
        }
      }
      const receipts: PrintedPageBatchResult['receipts'] = [];
      for (const [index, row] of rows.entries()) {
        let sent = false;
        try {
          input.assertCurrent();
          const range = ranges[index]!;
          sent = true;
          const receipt = await input.apply(row.target, row.snapshot, range, true);
          if (receipt.protocol !== 'omi-issue-page-range/1' || receipt.published !== false ||
              receipt.installationId !== row.target.installationId || receipt.contextId !== row.target.contextId ||
              receipt.issueId !== row.target.issueId || receipt.submissionId !== row.target.submissionId ||
              receipt.publicationId !== row.target.publicationId ||
              receipt.previousWorkflowToken !== row.snapshot.workflowToken || receipt.previousPages !== row.snapshot.pages ||
              receipt.pages !== printedPageLabel(range) || !/^[a-f0-9]{64}$/.test(receipt.workflowToken) ||
              receipt.unchanged !== (receipt.pages === receipt.previousPages)) throw new Error('Unconfirmed OJS printed page receipt.');
          receipts.push({ rootSectionId: row.target.rootSectionId, receipt: structuredClone(receipt) });
        } catch (error) {
          return { receipts, failed: { rootSectionId: row.target.rootSectionId, title: row.target.title,
            outcome: sent ? 'unconfirmed' : 'not-sent', message: error instanceof Error ? error.message : String(error) } };
        }
      }
      return { receipts };
    },
  };
}
