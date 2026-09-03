import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import { paginatePublicationBlocks } from '../src/components/publicationPageLayout.ts';
import {
  applyPublicationCorrectionsToStoredContent,
  classifyProofingTextChange,
  createProofingComment,
  createProofingTextDiff,
  createPublicationCorrection,
  decideProofingChange,
  normalizeProofingState,
  recordBlockTextChange,
  recordSectionTextChanges,
  restoreProofingChange,
  storedContentText,
} from '../src/model/proofing.ts';

const blockEditorSource = readFileSync(
  new URL('../src/components/BlockEditor.tsx', import.meta.url),
  'utf8',
);
const proofingPanelSource = readFileSync(
  new URL('../src/components/ProofingPanel.tsx', import.meta.url),
  'utf8',
);
const publicationEditorSource = readFileSync(
  new URL('../src/components/PublicationStyleEditor.tsx', import.meta.url),
  'utf8',
);
const publicationCanvasSource = readFileSync(
  new URL('../src/components/PublicationDocumentCanvas.tsx', import.meta.url),
  'utf8',
);
const publicationExportSource = readFileSync(
  new URL('../src/services/publicationStyleExport.ts', import.meta.url),
  'utf8',
);
const reviewModeSource = readFileSync(
  new URL('../src/components/ReviewMode.tsx', import.meta.url),
  'utf8',
);
const proofingLegendSource = readFileSync(
  new URL('../src/components/ProofingColorLegend.tsx', import.meta.url),
  'utf8',
);
const proofingStylesSource = readFileSync(
  new URL('../src/styles/proofreading.css', import.meta.url),
  'utf8',
);
const proofingMarksSource = readFileSync(
  new URL('../src/editor/extensions/OmiProofingMarksExtension.ts', import.meta.url),
  'utf8',
);

const paragraph = (text: string) => JSON.stringify({
  type: 'doc',
  content: [{ type: 'paragraph', content: text ? [{ type: 'text', text }] : [] }],
});

test('tracked text edits coalesce against the original and can be accepted or rejected', () => {
  const before = paragraph('Original sentence.');
  const first = paragraph('Edited sentence.');
  const second = paragraph('Carefully edited sentence.');
  const changes = recordBlockTextChange([], 'block-1', before, first, 'agent-1', '2026-09-03T10:00:00.000Z');
  const coalesced = recordBlockTextChange(changes, 'block-1', first, second, 'agent-1', '2026-09-03T10:01:00.000Z');

  assert.equal(coalesced.length, 1);
  assert.equal(coalesced[0]?.before, before);
  assert.equal(coalesced[0]?.after, second);
  assert.equal(coalesced[0]?.status, 'pending');

  const accepted = decideProofingChange({ trackChanges: true, changes: coalesced }, coalesced[0]!.id, 'accepted');
  assert.equal(accepted.changes[0]?.status, 'accepted');

  const restored = restoreProofingChange([
    { id: 'section-1', title: 'Section', blocks: [{ id: 'block-1', type: 'paragraph', content: second }] },
  ], coalesced[0]!);
  assert.equal(restored[0]?.blocks[0]?.content, before);
});

test('continuous document tracking records changed blocks only when tracking is enabled', () => {
  const previous = [{
    id: 'section-1',
    title: 'Section',
    blocks: [{ id: 'block-1', type: 'paragraph', content: paragraph('Before') }],
  }];
  const next = [{
    ...previous[0]!,
    blocks: [{ id: 'block-1', type: 'paragraph', content: paragraph('After') }],
  }];

  assert.equal(recordSectionTextChanges(previous, next, undefined), undefined);
  const tracked = recordSectionTextChanges(
    previous,
    next,
    { trackChanges: true, changes: [] },
  );
  assert.equal(normalizeProofingState(tracked).changes.length, 1);
  assert.equal(storedContentText(normalizeProofingState(tracked).changes[0]!.after), 'After');
});

test('proofing comments retain their selected range and peer-review visibility', () => {
  const comment = createProofingComment(
    { blockId: 'block-1', from: 7, to: 15, text: 'selected' },
    'Clarify this claim.',
    'editor_only',
    'reviewer-agent',
    '2026-09-03T10:00:00.000Z',
  );

  assert.deepEqual(comment.targetRange, { from: 7, to: 15 });
  assert.equal(comment.targetText, 'selected');
  assert.equal(comment.visibility, 'editor_only');
  assert.equal(comment.status, 'open');
});

test('the exact diff identifies the shared context and replacement', () => {
  assert.deepEqual(
    createProofingTextDiff('The old wording remains.', 'The new wording remains.'),
    { prefix: 'The ', removed: 'old', inserted: 'new', suffix: ' wording remains.' },
  );
});

test('tracked changes are classified for consistent color highlighting', () => {
  assert.equal(classifyProofingTextChange('', 'Inserted text'), 'insertion');
  assert.equal(classifyProofingTextChange('Deleted text', ''), 'deletion');
  assert.equal(classifyProofingTextChange('Old text', 'New text'), 'replacement');
  const strongText = JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Same', marks: [{ type: 'bold' }] }] }],
  });
  const italicText = JSON.stringify({
    type: 'doc',
    content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Same', marks: [{ type: 'italic' }] }] }],
  });
  assert.equal(
    classifyProofingTextChange(strongText, italicText),
    'formatting',
  );
});

test('inline publication corrections alter only a cloned rendering payload', () => {
  const source = paragraph('hosszú kifejezés');
  const corrections = [
    createPublicationCorrection({ targetBlockId: 'block-1', kind: 'discretionary-hyphen', from: 4 }, '2026-09-03T10:00:00.000Z'),
    createPublicationCorrection({ targetBlockId: 'block-1', kind: 'nonbreaking', from: 6, to: 15 }, '2026-09-03T10:00:00.000Z'),
    createPublicationCorrection({ targetBlockId: 'block-1', kind: 'forced-line-break', from: 16 }, '2026-09-03T10:00:00.000Z'),
  ];
  const rendered = applyPublicationCorrectionsToStoredContent(source, corrections);

  assert.equal(source.includes('\u00ad'), false);
  assert.equal(source.includes('\u00a0'), false);
  assert.match(rendered, /hoss/);
  assert.equal(storedContentText(rendered).replaceAll('\u00ad', '').replaceAll('\u00a0', ' '), 'hosszú kifejezés');
  assert.match(rendered, /"type":"hardBreak"/);
});

test('stale ranged publication corrections do not alter newly edited text', () => {
  const source = paragraph('new wording');
  const correction = createPublicationCorrection({
    targetBlockId: 'block-1',
    kind: 'nonbreaking',
    from: 0,
    to: 11,
    sourceText: 'old wording',
  }, '2026-09-03T10:00:00.000Z');

  assert.equal(applyPublicationCorrectionsToStoredContent(source, [correction]), source);
});

test('manual page breaks and keep-with-next rules affect screen pagination', () => {
  const forced = paginatePublicationBlocks(
    [
      { top: 0, height: 30 },
      { top: 30, height: 20, forcePageBreakBefore: true },
    ],
    100,
    50,
  );
  assert.deepEqual(forced.placements, [
    { pageIndex: 0, translateY: 0 },
    { pageIndex: 1, translateY: 120 },
  ]);

  const kept = paginatePublicationBlocks(
    [
      { top: 75, height: 10, keepWithNext: true },
      { top: 85, height: 25 },
    ],
    100,
    50,
  );
  assert.equal(kept.placements[0]?.pageIndex, 1);
  assert.equal(kept.placements[1]?.pageIndex, 1);
});

test('both editor surfaces expose Word-like proofing controls', () => {
  assert.match(blockEditorSource, /OmiProofingMarksExtension/);
  assert.match(proofingPanelSource, /setTrackChanges/);
  assert.match(proofingPanelSource, /acceptProofingChange/);
  assert.match(proofingPanelSource, /addProofingComment/);
  assert.match(publicationEditorSource, /panelId="proofing"/);
  assert.match(publicationEditorSource, /'discretionary-hyphen'/);
  assert.match(publicationEditorSource, /'page-break-before'/);
  assert.match(publicationCanvasSource, /publicationCorrections/);
  assert.match(publicationExportSource, /applyPublicationCorrectionsForRendering/);
  assert.match(publicationExportSource, /data-omi-publication-corrections/);
});

test('peer review compares against the anonymous source and supports scoped comments', () => {
  assert.match(reviewModeSource, /createProofingTextDiff/);
  assert.match(reviewModeSource, /review-mode__proofing-toolbar/);
  assert.match(reviewModeSource, /AUTHOR_AND_EDITOR/);
  assert.match(reviewModeSource, /EDITOR_ONLY/);
  assert.match(reviewModeSource, /original=\{manuscript\}/);
  assert.match(reviewModeSource, /identityNotice/);
});

test('editor, peer review, and publication proofing share accessible color legends', () => {
  assert.match(proofingPanelSource, /ProofingColorLegend locale=\{locale\} mode="editor"/);
  assert.match(reviewModeSource, /ProofingColorLegend locale=\{locale\} mode="editor"/);
  assert.match(publicationEditorSource, /ProofingColorLegend locale=\{locale\} mode="publication"/);
  assert.match(proofingLegendSource, /data-proofing-kind=\{item\.kind\}/);
  assert.match(proofingLegendSource, /MessageSquare/);
  assert.match(proofingStylesSource, /omi-proofing-insertion-range/);
  assert.match(proofingStylesSource, /data-proofing-kind='comment'/);
  assert.match(proofingStylesSource, /data-proofing-kind='page-break-before'/);
  assert.match(proofingMarksSource, /addTrackedChangeDecoration/);
});
