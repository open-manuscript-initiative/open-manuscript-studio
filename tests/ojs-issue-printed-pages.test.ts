import assert from 'node:assert/strict';
import test from 'node:test';
import { createPrintedPageReviewRow, reviewedPrintedPageRanges, preparePrintedPageBatch } from '../src/app/ojsIssuePrintedPageActions.ts';
import { printedPageLabel, prepareIssuePageWrite, validatePrintedIssueRanges, pageIdentity, type OjsIssuePageReceipt, type OjsIssuePageSnapshot } from '../src/model/ojsIssuePrintedPages.ts';

const target = { rootSectionId: 'a', title: 'Article', installationId: 'journal', contextId: 1, issueId: 4, submissionId: 12, publicationId: 13 };
const snapshot: OjsIssuePageSnapshot = { ...pageIdentity(target), protocol: 'omi-issue-page-range/1', pages: null, workflowToken: 'a'.repeat(64), published: false };
const range = { firstPrintedPage: 101, lastPrintedPage: 118 };
test('printed range is explicit and bound to the inspected publication', () => {
  assert.equal(printedPageLabel(range), '101-118');
  assert.equal(printedPageLabel({ firstPrintedPage: 101, lastPrintedPage: 101 }), '101');
  assert.deepEqual(prepareIssuePageWrite(target, snapshot, range, true), {
    ...pageIdentity(target), action: 'apply', ...range, expectedWorkflowToken: snapshot.workflowToken, confirmed: true,
  });
  assert.throws(() => prepareIssuePageWrite(target, { ...snapshot, issueId: 5 }, range, true));
  assert.throws(() => prepareIssuePageWrite(target, { ...snapshot, workflowToken: '' }, range, true));
  assert.throws(() => printedPageLabel({ firstPrintedPage: 118, lastPrintedPage: 101 }));
  assert.throws(() => printedPageLabel({ firstPrintedPage: 0, lastPrintedPage: 1 }));
});
test('batch review refuses overlaps, mixed journals and missing articles', () => {
  const second = { ...target, rootSectionId: 'b', submissionId: 14, publicationId: 15 };
  const ranges = [{ rootSectionId: 'a', ...range }, { rootSectionId: 'b', firstPrintedPage: 119, lastPrintedPage: 140 }];
  assert.doesNotThrow(() => validatePrintedIssueRanges([target, second], ranges));
  assert.throws(() => validatePrintedIssueRanges([target, second], [ranges[0]!]));
  assert.throws(() => validatePrintedIssueRanges([target, { ...second, contextId: 2 }], ranges));
  assert.throws(() => validatePrintedIssueRanges([target, second], [ranges[0]!, { ...ranges[1]!, firstPrintedPage: 118 }]));
});


test('printed page batch requires manual approval and all-target preflight, then preserves partial receipts', async () => {
  const second = { ...target, rootSectionId: 'b', submissionId: 14, publicationId: 15 };
  const firstSnapshot = { ...snapshot, pages: '101–118' };
  const secondSnapshot = { ...snapshot, ...pageIdentity(second), pages: null };
  const first = createPrintedPageReviewRow(target, firstSnapshot);
  assert.deepEqual([first.first, first.last, first.reviewed], ['101','118',false]);
  assert.throws(() => reviewedPrintedPageRanges([first]));
  const rows = [{ ...first, reviewed: true }, { ...createPrintedPageReviewRow(second, secondSnapshot), first: '119', last: '140', reviewed: true }];
  assert.throws(() => reviewedPrintedPageRanges([rows[0]!, { ...rows[1]!, first: '118' }]));
  assert.throws(() => reviewedPrintedPageRanges([{ ...rows[0]!, first: '1e2' }, rows[1]!]));
  let stale = true, writes = 0;
  const input = {
    rows, assertCurrent: () => {},
    inspect: async (item: typeof target) => item.rootSectionId === 'a' ? firstSnapshot : { ...secondSnapshot, workflowToken: stale ? 'c'.repeat(64) : secondSnapshot.workflowToken },
    apply: async (item: typeof target, before: OjsIssuePageSnapshot, range: { firstPrintedPage: number; lastPrintedPage: number }): Promise<OjsIssuePageReceipt> => {
      writes++;
      if (item.rootSectionId === 'b') throw Error('Uncertain transfer');
      return { ...pageIdentity(item), protocol: 'omi-issue-page-range/1', previousPages: before.pages, pages: printedPageLabel(range),
        previousWorkflowToken: before.workflowToken, workflowToken: 'b'.repeat(64), unchanged: false, published: false };
    },
  };
  await assert.rejects(preparePrintedPageBatch(input).execute(true), /metadata changed/);
  assert.equal(writes, 0);
  stale = false;
  const batch = preparePrintedPageBatch(input);
  const result = await batch.execute(true);
  assert.equal(writes, 2);
  assert.equal(result.receipts.length, 1);
  assert.equal(result.receipts[0]?.receipt.pages, '101-118');
  assert.equal(result.failed?.outcome, 'unconfirmed');
  await assert.rejects(batch.execute(true), /replay/);
});
