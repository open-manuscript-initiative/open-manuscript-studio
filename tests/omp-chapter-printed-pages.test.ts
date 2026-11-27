import assert from 'node:assert/strict';
import test from 'node:test';
import { listOmpChapterTransferTargets } from '../src/model/ompChapterTransferTargets.ts';
import { prepareChapterPageWrite, validatePrintedChapterRanges, type OmpChapterPageSnapshot } from '../src/model/ompChapterPrintedPages.ts';
import { ompChapterPagesRequest, validateOmpChapterPagesResponse } from '../server/src/contracts/ompChapterPagesContract.ts';
import { createVolumeFromOmpHandoff, type OmpVolumeHandoff } from '../src/integrations/omp/importOmpVolume.ts';
const fixture = (): OmpVolumeHandoff => ({
  protocol: 'omi-integration/1', profile: 'omi-integration/1/omp', kind: 'volume', installation: { installationId: 'press' },
  context: { externalId: '1' }, volume: { externalId: '2', publicationExternalId: '3', title: { hu: 'Kötet' } },
  doi: null, workType: 'edited-volume', mode: 'chapters', contributors: [],
  chapters: [{ externalId: '4', publicationExternalId: '3', sourceChapterId: '4', sequence: 1, title: { hu: 'Fejezet' }, contributorExternalIds: [] },
    { externalId: '6', publicationExternalId: '3', sourceChapterId: '6', sequence: 2, title: { hu: 'Második' }, contributorExternalIds: [] }],
  sources: [{ chapterExternalId: '4', sourceDocument: { kind: 'docx', fileExternalId: '5', paragraphs: [{ text: 'Original' }] } },
    { chapterExternalId: '6', sourceDocument: { kind: 'docx', fileExternalId: '7', paragraphs: [{ text: 'Second' }] } }],
});
test('native chapter identities stay scoped to one publication; shared boundary pages are allowed', () => {
  const volume = createVolumeFromOmpHandoff(fixture(), 'hu');
  const targets = listOmpChapterTransferTargets(volume);
  assert.deepEqual(targets.map(t => t.chapterId), [4, 6]);
  const ranges = [{ rootSectionId: targets[0]!.rootSectionId, firstPrintedPage: 10, lastPrintedPage: 20 },
    { rootSectionId: targets[1]!.rootSectionId, firstPrintedPage: 20, lastPrintedPage: 25 }];
  validatePrintedChapterRanges(targets, ranges);
  assert.throws(() => validatePrintedChapterRanges(targets, [ranges[0]!, { ...ranges[1]!, firstPrintedPage: 19 }]));
  assert.throws(() => validatePrintedChapterRanges([targets[0]!, { ...targets[1]!, publicationId: 99 }], ranges));
});
test('chapter request and receipt are bound to exact target and stale token', () => {
  const target = listOmpChapterTransferTargets(createVolumeFromOmpHandoff(fixture(), 'hu'))[0]!;
  const identity = { installationId: target.installationId, contextId: target.contextId, submissionId: target.submissionId,
    publicationId: target.publicationId, chapterId: target.chapterId };
  const snapshot: OmpChapterPageSnapshot = { ...identity, sourceChapterId: 4, protocol: 'omi-chapter-page-range/1',
    pages: null, workflowToken: 'a'.repeat(64), published: false };
  const request = ompChapterPagesRequest.parse(prepareChapterPageWrite(target, snapshot, { firstPrintedPage: 12, lastPrintedPage: 15 }, true));
  const response = { snapshot: { ...snapshot, pages: '12-15', workflowToken: 'b'.repeat(64) },
    receipt: { ...identity, protocol: 'omi-chapter-page-range/1', published: false, previousPages: null, pages: '12-15',
      previousWorkflowToken: snapshot.workflowToken, workflowToken: 'b'.repeat(64), unchanged: false } };
  assert.equal(validateOmpChapterPagesResponse(request, response).receipt?.pages, '12-15');
  assert.throws(() => validateOmpChapterPagesResponse(request, { ...response, receipt: { ...response.receipt, chapterId: 6 } }));
  assert.throws(() => prepareChapterPageWrite(target, { ...snapshot, sourceChapterId: 99 }, { firstPrintedPage: 12, lastPrintedPage: 15 }, true));
});
