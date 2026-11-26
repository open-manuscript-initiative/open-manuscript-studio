import assert from 'node:assert/strict';
import test from 'node:test';
import { printedPageLabel, prepareIssuePageWrite, validatePrintedIssueRanges, pageIdentity } from '../src/model/ojsIssuePrintedPages.ts';
import type { OjsIssuePageSnapshot } from '../src/model/ojsIssuePrintedPages.ts';

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
