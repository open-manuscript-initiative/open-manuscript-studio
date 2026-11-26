import assert from 'node:assert/strict';
import test from 'node:test';
import { createIssuePdfReviewRows, editIssuePdfReviewRow, reviewedIssuePdfRanges } from '../src/model/issuePdfReview.ts';
import { proposeIssuePdfRanges, validateReviewedIssueRanges } from '../src/model/issuePdfPageRanges.ts';

const first = { rootSectionId: 'a', title: 'First', startText: 'First study about historical manuscripts', endText: 'Final sentence of the first contribution' };
const second = { rootSectionId: 'b', title: 'Second', startText: 'Second study about historical letters', endText: 'Final sentence of the second contribution' };

test('actual PDF physical pages include covers and inserted blanks; never estimate from screen pagination', () => {
  const pages = ['Cover', '', first.startText, 'Body', first.endText, '', second.startText, second.endText, 'Back matter'];
  const result = proposeIssuePdfRanges(pages, [first, second]);
  assert.deepEqual(result.map(item => [item.firstPage, item.lastPage, item.requiresReview]), [[3, 5, true], [7, 8, true]]);
});
test('hyphenated text anchors tolerate discretionary line breaks', () => {
  const result = proposeIssuePdfRanges(['First study about historical manu-\nscripts', first.endText], [first]);
  assert.equal(result[0]?.firstPage, 1);
  assert.equal(result[0]?.lastPage, 2);
});
test('repeated titles, missing tails and short anchors are not guessed', () => {
  assert.equal(proposeIssuePdfRanges([first.startText, first.startText, first.endText], [first])[0]?.problem, 'ambiguous-anchor');
  assert.equal(proposeIssuePdfRanges([first.startText], [first])[0]?.problem, 'missing-anchor');
  assert.equal(proposeIssuePdfRanges([first.startText], [{ ...first, endText: 'short' }])[0]?.problem, 'insufficient-evidence');
  assert.equal(proposeIssuePdfRanges([first.endText, first.startText], [first])[0]?.problem, 'reversed-range');
});
test('shared pages are rejected; review must cover every study in current order', () => {
  const result = proposeIssuePdfRanges([first.startText, first.endText + ' ' + second.startText, second.endText], [first, second]);
  assert.deepEqual(result.map(item => item.problem), ['overlapping-or-out-of-order', 'overlapping-or-out-of-order']);
  assert.throws(() => validateReviewedIssueRanges(5, ['a','b'], [{ rootSectionId:'a', firstPage:1,lastPage:3 },{ rootSectionId:'b', firstPage:3,lastPage:5 }]));
  assert.throws(() => validateReviewedIssueRanges(5, ['a','b'], [{ rootSectionId:'a', firstPage:1,lastPage:2 }]));
  assert.doesNotThrow(() => validateReviewedIssueRanges(5, ['a','b'], [{ rootSectionId:'a', firstPage:1,lastPage:2 },{ rootSectionId:'b', firstPage:4,lastPage:5 }]));
});


test('range suggestions are never implicitly approved and editing revokes confirmation', () => {
  const rows = createIssuePdfReviewRows([
    { rootSectionId: 'a', title: 'A', firstPage: 3, lastPage: 7, requiresReview: true },
    { rootSectionId: 'b', title: 'B', problem: 'missing-anchor', requiresReview: true },
  ]);
  assert.deepEqual(rows.map(row => [row.first, row.last, row.reviewed]), [['3','7',false],['','',false]]);
  assert.throws(() => reviewedIssuePdfRanges(20, ['a','b'], rows));
  const approved = [{ ...rows[0]!, reviewed: true }, { ...rows[1]!, first: '8', last: '20', reviewed: true }];
  assert.deepEqual(reviewedIssuePdfRanges(20, ['a','b'], approved), [
    { rootSectionId: 'a', firstPage: 3, lastPage: 7 }, { rootSectionId: 'b', firstPage: 8, lastPage: 20 },
  ]);
  const edited = editIssuePdfReviewRow(approved, 'b', 'first', '9');
  assert.equal(edited[1]?.reviewed, false);
  assert.equal(edited[0]?.reviewed, true);
  assert.throws(() => reviewedIssuePdfRanges(20, ['a','b'], edited));
});
test('review rejects incomplete, reordered, overlapping and non-decimal range inputs', () => {
  const row = { rootSectionId: 'a', first: '3', last: '7', reviewed: true };
  const next = { rootSectionId: 'b', first: '8', last: '20', reviewed: true };
  for (const invalid of [
    [row], [next,row], [row,{...next, first:'7'}], [row,{...next, last:'21'}],
    [{...row,first:'3e0'},next], [{...row,first:'3.0'},next], [{...row,first:''},next],
  ]) assert.throws(() => reviewedIssuePdfRanges(20,['a','b'],invalid));
});
