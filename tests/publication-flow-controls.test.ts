import assert from 'node:assert/strict';
import test from 'node:test';
import { createPublicationPaginationEngine, publicationWorkerSections, type PublicationWorkerRequest, type PublicationWorkerResponse } from '../src/components/publicationPaginationEngine.ts';
import { createPublicationPaginationWorkerClient, type PublicationWorkerPort } from '../src/components/publicationPaginationWorkerClient.ts';
import { canvasPageGeometry } from '../src/components/publicationPageGeometry.ts';
import { createFrameLayout, flowFrameStories, FRAME_LAYOUT_EXTENSION, linkFrames, unlinkFrames, updateFrameStoryText, validateFrameLayout, RECTANGLE_POINTS, type PublicationFrame } from '../src/model/publicationFrames.ts';
import { paginateAutomaticFrameLayout, createDefaultFlowFrameLayout } from '../src/model/publicationAutoFlow.ts';
import { framePageStyle, withFramePages } from '../src/model/publicationFramePages.ts';
import { paginatePublicationBlocks, publicationSectionFitWarnings, createIncrementalPublicationPaginator, createPublicationPageMetricsResolver, type PublicationFlowBlock } from '../src/components/publicationPageLayout.ts';
import { capturePublicationPageStyle, resolvePublicationPageStyle, validatePublicationPageStyles, withoutPublicationPageAssignments } from '../src/model/publicationPageStyles.ts';
import { clonePublicationStyleTemplate, clonePublicationPublisherTemplate, renderStyleBasedHtml, withInsertedPublicationPages } from '../src/services/publicationStyleExport.ts';
import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { stageMoveSectionSibling } from '../src/app/sectionActions.ts';
import { stageAppliedPublicationStyle } from '../src/app/publicationTemplateActions.ts';

const measure = (text: string) => text.length;
const metrics = (index: number) => ({ bodyHeight: 100, bodyTop: index * 120 });
function frame(id: string, page: number, storyId = 'story'): PublicationFrame {
  return { id, name: id, kind: 'text', page, storyId, styleId: 'frame-style-default',
    xMm: 10, yMm: 10, widthMm: 80, heightMm: 40, rotation: 0, shape: 'rectangle', points: structuredClone(RECTANGLE_POINTS) };
}
function brokenStory(kind: 'page' | 'frame') {
  const layout = withFramePages(createFrameLayout());
  layout.page.count = 2;
  layout.pages!.push({ id: 'page-2', styleId: layout.pageStyles![0]!.id });
  layout.stories = [{ id: 'story', name: 'Story', text: 'FIRST SECOND', breaks: [{ offset: 6, kind }] }];
  layout.frames = [{ ...frame('one', 0), nextFrameId: 'two' }, { ...frame('two', 0), nextFrameId: 'three' }, frame('three', 1)];
  return layout;
}

test('page breaks skip same-page linked frames while frame breaks use them, preserving every character', () => {
  for (const kind of ['page', 'frame'] as const) {
    const layout = brokenStory(kind);
    const result = flowFrameStories(layout, measure);
    assert.equal(result.frames[0]!.end, 6);
    assert.equal(result.frames[1]!.end, kind === 'page' ? 6 : layout.stories[0]!.text.length);
    assert.equal(result.frames.flatMap((item) => item.lines.map((line) => line.text)).join(''), 'FIRST SECOND');
    assert.equal(result.overflow.length, 0);
    layout.stories[0]!.breaks = [];
    assert.equal(flowFrameStories(layout, measure).frames[0]!.end, layout.stories[0]!.text.length);
  }
});

test('break at a full-frame boundary is consumed once, with no empty continuation page', () => {
  const layout = brokenStory('page');
  layout.frames[0]!.heightMm = 5;
  layout.frames[0]!.widthMm = 12;
  layout.styles[0]!.properties.paddingMm = 0;
  layout.styles[0]!.properties.fontSizePt = 10;
  layout.styles[0]!.properties.lineHeightPt = 10;
  layout.frames[0]!.widthMm = 6;
  const result = flowFrameStories(layout, measure);
  assert.equal(result.frames[0]!.end, 6);
  assert.equal(result.frames[2]!.start, 6);
  assert.equal(result.frames[2]!.end, 12);
});

test('break anchors follow edits, collapse safely on deletion, and survive linking/unlinking and OMI round-trip', () => {
  const layout = brokenStory('page');
  const story = updateFrameStoryText(layout.stories[0]!, 'XX FIRST SECOND');
  assert.equal(story.breaks![0]!.offset, 9);
  assert.deepEqual(updateFrameStoryText(story, 'FIRST SECOND').breaks, layout.stories[0]!.breaks);
  const collapsed = updateFrameStoryText({ id: 'x', name: 'X', text: 'abcdef', breaks: [{ offset: 1, kind: 'frame' }, { offset: 4, kind: 'page' }] }, 'aef');
  assert.equal(collapsed.breaks?.length, 1);
  const split = unlinkFrames(layout, 'one', 6, 'tail');
  const joined = linkFrames(split, 'one', 'two');
  assert.equal(joined.stories[0]!.text, 'FIRST SECOND');
  assert.deepEqual(joined.stories[0]!.breaks, layout.stories[0]!.breaks);
  const manuscript = createVersionedTestManuscript();
  manuscript.extensions = { ...manuscript.extensions, [FRAME_LAYOUT_EXTENSION]: layout };
  assert.deepEqual(parseOmiJson(serializeOmiJson(manuscript)).extensions![FRAME_LAYOUT_EXTENSION], layout);
});

test('break validation rejects invalid types, offsets and grapheme splits', () => {
  for (const breaks of [[{ offset: -1, kind: 'page' }], [{ offset: 2, kind: 'invalid' }], [{ offset: 2, kind: 'page' }, { offset: 1, kind: 'page' }], [{ offset: 1, kind: 'page' }]]) {
    const layout = brokenStory('page');
    layout.stories[0]!.text = '👩🏽‍💻 text';
    layout.stories[0]!.breaks = breaks as never;
    assert.throws(() => validateFrameLayout(layout), /story break/);
  }
});

test('any text story can grow independently using its continuation page style and shrink around other stories', () => {
  const layout = withFramePages(createFrameLayout());
  const wide = structuredClone(layout.pageStyles![0]!); wide.id = 'wide'; wide.widthMm = 240; wide.heightMm = 160;
  layout.pageStyles!.push(wide);
  layout.stories = [{ id: 'a', name: 'A', text: 'content '.repeat(900), autoContinue: true, continuationStyleId: 'wide' },
    { id: 'b', name: 'B', text: 'second '.repeat(300), autoContinue: true }];
  layout.frames = [frame('a-root', 0, 'a'), { ...frame('b-root', 0, 'b'), yMm: 70 }];
  const grown = paginateAutomaticFrameLayout(layout, measure);
  assert.ok(grown.page.count > 2);
  assert.equal(flowFrameStories(grown, measure).overflow.length, 0);
  const aFrame = grown.frames.find((item) => item.storyId === 'a' && item.autoGenerated)!;
  assert.equal(framePageStyle(grown, aFrame.page).id, 'wide');
  assert.equal(aFrame.widthMm, wide.widthMm - wide.margins.left - wide.margins.right);
  const before = grown.page.count;
  grown.stories[0]!.text = 'short';
  const shrunk = paginateAutomaticFrameLayout(grown, measure);
  assert.ok(shrunk.page.count < before);
  assert.equal(flowFrameStories(shrunk, measure).overflow.length, 0);
  assert.equal(shrunk.stories[1]!.text, layout.stories[1]!.text);
  validateFrameLayout(shrunk);
});

test('automatic continuation can be disabled without deleting text or placed pages', () => {
  const layout = createDefaultFlowFrameLayout();
  layout.stories[0]!.text = 'word '.repeat(20000);
  layout.stories[0]!.autoContinue = false;
  const result = paginateAutomaticFrameLayout(layout, measure);
  assert.equal(result.page.count, 1);
  assert.ok(flowFrameStories(result, measure).overflow.length);
});

test('a section that fits a fresh page moves together; a longer section continues and reports its range', () => {
  const blocks: PublicationFlowBlock[] = [
    { sectionId: 'a', top: 0, height: 70 },
    { sectionId: 'b', top: 70, height: 20, keepSectionTogether: true },
    { sectionId: 'b', top: 90, height: 20, keepSectionTogether: true },
  ];
  const together = paginatePublicationBlocks(blocks, 100, 20, undefined, metrics);
  assert.deepEqual(together.placements.map((item) => item.pageIndex), [0, 1, 1]);
  assert.equal(together.sectionWarnings![0]!.reason, 'moved');
  blocks[1] = { sectionId: 'b', top: 70, height: 120, keepSectionTogether: true, splittable: true,
    lines: Array.from({ length: 6 }, (_, index) => ({ top: index * 20, height: 20, textOffset: index * 10 })) };
  blocks.splice(2);
  const continued = paginatePublicationBlocks(blocks, 100, 20, undefined, metrics);
  assert.equal(continued.sectionWarnings![0]!.reason, 'oversized');
  assert.ok(continued.flowBreaks.length > 0);
  assert.ok(publicationSectionFitWarnings(blocks, continued).some((issue) => issue.sectionId === 'b'));
});

test('keep-section respects footnote space rather than forcing a combined section through the footer', () => {
  const result = paginatePublicationBlocks([
    { sectionId: 'a', top: 0, height: 60 },
    { sectionId: 'b', top: 60, height: 20, keepSectionTogether: true, noteIds: ['note'] },
    { sectionId: 'b', top: 80, height: 20, keepSectionTogether: true },
  ], 100, 20, { heights: new Map([['note', 20]]), lineHeight: 10, separatorHeight: 5 }, metrics);
  assert.deepEqual(result.placements.map((item) => item.pageIndex), [0, 1, 1]);
  assert.equal(result.pageNotes![1]![0]!.id, 'note');
});

test('inserted pages reserve complete sheets before their block and deletion reflows without altering blocks', () => {
  const blocks: PublicationFlowBlock[] = [{ sectionId: 'a', top: 0, height: 20 },
    { sectionId: 'a', top: 20, height: 20, insertedPagesBefore: [{ id: 'blank', styleId: 'plate' }] }];
  const before = structuredClone(blocks);
  const called: unknown[] = [];
  const result = paginatePublicationBlocks(blocks, 100, 20, undefined, (index, section, style) => {
    if (style) called.push([index, section, style]);
    return metrics(index);
  });
  assert.equal(result.pageCount, 3);
  assert.equal(result.placements[1]!.pageIndex, 2);
  assert.deepEqual(result.insertedPages, [{ pageIndex: 1, id: 'blank', styleId: 'plate' }]);
  assert.deepEqual(called, [[1, undefined, 'plate']]);
  assert.deepEqual(blocks, before);
  delete blocks[1]!.insertedPagesBefore;
  assert.equal(paginatePublicationBlocks(blocks, 100, 20, undefined, metrics).pageCount, 1);
});

test('blank pages never absorb carried footnotes and multiple inserts at the first block have no phantom page', () => {
  const result = paginatePublicationBlocks([{ sectionId: 'a', top: 0, height: 20,
    insertedPagesBefore: [{ id: 'one' }, { id: 'two' }], noteIds: ['note'] }], 100, 20,
  { heights: new Map([['note', 150]]), lineHeight: 10, separatorHeight: 5 }, metrics);
  assert.deepEqual(result.insertedPages!.map((page) => page.pageIndex), [0, 1]);
  assert.equal(result.placements[0]!.pageIndex, 2);
  assert.equal(result.pageNotes![0], undefined);
  assert.equal(result.pageNotes![1], undefined);
  assert.equal(result.pageNotes!.flat().reduce((sum, note) => sum + note.height, 0), 150);
});

test('insertion anchors and section keep rules survive OMI but are removed from reusable page assignments', async () => {
  const manuscript = createVersionedTestManuscript();
  const blockId = manuscript.sections[0]!.blocks[0]!.id;
  const style = clonePublicationStyleTemplate();
  const master = capturePublicationPageStyle(style, 'plate', 'Plate'); master.page.width = 180;
  style.pageStyles = { version: 1, styles: [master], sections: [{ sectionId: manuscript.sections[0]!.id, startNewPage: false, keepTogether: true }], pages: [],
    insertions: [{ id: 'blank', beforeBlockId: blockId, styleId: 'plate' }, { id: 'orphan', beforeBlockId: 'removed-block' }] };
  validatePublicationPageStyles(style.pageStyles);
  assert.equal(resolvePublicationPageStyle(style, manuscript.sections, 0, undefined, 'plate').page.width, 180);
  style.pageStyles.pages = [{ from: style.page.pageNumberStart ?? 1, to: style.page.pageNumberStart ?? 1, styleId: 'plate' }];
  assert.equal(resolvePublicationPageStyle(style, manuscript.sections, 0, undefined, '').page.width, style.page.width);
  assert.equal(withoutPublicationPageAssignments(style).pageStyles?.insertions, undefined);
  const context = { style, identity: clonePublicationPublisherTemplate() };
  const html = await renderStyleBasedHtml(manuscript, resolvePublicationProfile(manuscript), 'print', context);
  assert.match(html, /data-omi-inserted-page="blank"/);
  assert.doesNotMatch(html, /<div[^>]*data-omi-inserted-page="orphan"/);
  assert.match(html, /@page omi_inserted_0\{size:180mm/);
  assert.match(html, /break-inside:avoid/);
  assert.doesNotMatch(await renderStyleBasedHtml(manuscript, resolvePublicationProfile(manuscript), 'html', context), /data-omi-inserted-page/);
  for (const tag of ['script', 'SCRIPT', 'ScRiPt']) {
    const malicious = structuredClone(style);
    malicious.pageStyles!.insertions = [{ id: `"><${tag} src=x>payload</${tag}>`, beforeBlockId: blockId }];
    const escaped = withInsertedPublicationPages(`<p data-omi-block-id="${blockId}">text</p>`, malicious);
    assert.doesNotMatch(escaped, /<script\b/i);
    assert.match(escaped, /&lt;/);
  }
  for (const invalid of [{ id: 'a', beforeBlockId: blockId, styleId: 'missing' }, { id: '', beforeBlockId: blockId }]) {
    const collection = structuredClone(style.pageStyles); collection.insertions = [invalid];
    assert.throws(() => validatePublicationPageStyles(collection));
  }
});

test('moving a study carries all descendants while notes, contributors and insertion anchors keep their identities', () => {
  const prior = useStudioStore.getState();
  try {
    const manuscript = createVersionedTestManuscript();
    const first = { id: 'first', title: 'First', blocks: [{ id: 'one', type: 'paragraph', content: 'First text' }] };
    const child = { id: 'child', title: 'Child', parentSectionId: 'first', blocks: [{ id: 'nested', type: 'paragraph', content: 'Nested text' }] };
    const second = { id: 'second', title: 'Second', blocks: [{ id: 'two', type: 'paragraph', content: 'Second text' }] };
    useStudioStore.getState().loadManuscript({ ...manuscript, sections: [first, child, second] });
    const style = clonePublicationStyleTemplate();
    style.pageStyles = { version: 1, styles: [], sections: [], pages: [], insertions: [{ id: 'blank', beforeBlockId: 'nested' }] };
    stageAppliedPublicationStyle(style);
    const before = useStudioStore.getState().manuscript;
    assert.equal(stageMoveSectionSibling('first', 1), true);
    const after = useStudioStore.getState().manuscript;
    assert.deepEqual(after.sections.map((item) => item.id), ['second', 'first', 'child']);
    assert.deepEqual(after.sections.find((item) => item.id === 'child')!.blocks, before.sections.find((item) => item.id === 'child')!.blocks);
    assert.deepEqual(after.annotations, before.annotations);
    assert.deepEqual(after.contributions, before.contributions);
    assert.deepEqual(after.extensions, before.extensions);
    assert.ok(useStudioStore.getState().pendingChangeSet);
  } finally { useStudioStore.setState(prior); }
});

test('note-heavy pagination retains all note fragments and reservation limits in both layout modes', () => {
  const heights = new Map(Array.from({ length: 300 }, (_, index) => ['note-' + index, (index % 11 + 1) * 5] as const));
  const blocks: PublicationFlowBlock[] = Array.from({ length: 300 }, (_, index) => ({
    sectionId: 'article', top: index * 12, height: 10,
    noteIds: ['note-' + index, ...(index > 0 ? ['note-' + (index - 1)] : [])],
  }));
  for (const styled of [false, true]) {
    for (const allowPageContinuation of [false, true]) {
      const result = paginatePublicationBlocks(blocks, 100, 20,
        { heights, lineHeight: 5, separatorHeight: 5, allowPageContinuation },
        styled ? metrics : undefined);
      const totals = new Map<string, number>();
      for (const fragments of result.pageNotes ?? []) {
        if (!fragments) continue;
        assert.ok(fragments.reduce((sum, item) => sum + item.height, 0) <= 50.0001);
        for (const fragment of fragments) {
          assert.equal(fragment.offset, totals.get(fragment.id) ?? 0);
          totals.set(fragment.id, fragment.offset + fragment.height);
        }
      }
      assert.deepEqual(totals, heights);
      assert.equal(result.placements.length, blocks.length);
    }
  }
});

test('complex pagination reuses only equivalent measured layouts and restores inserted page geometry', () => {
  const paginator = createIncrementalPublicationPaginator();
  const key = {};
  const blocks: PublicationFlowBlock[] = Array.from({ length: 300 }, (_, index) => ({
    sectionId: index < 150 ? 'a' : 'b', top: index * 18, height: 15,
    noteIds: index % 10 === 0 ? ['n' + index] : [],
    insertedPagesBefore: index === 150 ? [{ id: 'blank', styleId: 'plate' }] : undefined,
  }));
  const heights = new Map(Array.from({ length: 30 }, (_, i) => ['n' + i * 10, 70] as const));
  const geometry = (index: number, sectionId?: string, insertedStyleId?: string) => ({
    height: insertedStyleId === 'plate' ? 180 : sectionId === 'a' ? 120 : 140,
    bodyHeight: insertedStyleId === 'plate' ? 140 : sectionId === 'a' ? 80 : 100,
    topMargin: 20 + index % 2,
  });
  const notes = { heights, lineHeight: 5, separatorHeight: 5 };
  const run = (input: PublicationFlowBlock[], identity = key) => {
    const resolver = createPublicationPageMetricsResolver(geometry, 10, 20);
    const layout = paginator.paginate(input, 80, 40, notes, resolver.metrics, { key: identity, snapshot: resolver.snapshot, restore: resolver.restore });
    return { layout, state: resolver.snapshot(), resolver };
  };
  const first = run(blocks);
  const second = run(structuredClone(blocks));
  assert.strictEqual(second.layout, first.layout);
  assert.deepEqual(second.state, first.state);
  const inserted = second.layout.insertedPages![0]!;
  assert.equal(second.resolver.insertionStyles.get(inserted.pageIndex), 'plate');
  const expected = (input: PublicationFlowBlock[]) => paginatePublicationBlocks(input, 80, 40, notes, createPublicationPageMetricsResolver(geometry, 10, 20).metrics);
  heights.set('n0', 100);
  const changedNote = run(blocks);
  assert.notStrictEqual(changedNote.layout, first.layout);
  assert.deepEqual(changedNote.layout, expected(blocks));
  const changed = structuredClone(blocks);
  changed[150]!.insertedPagesBefore = [{ id: 'new', styleId: '' }];
  assert.deepEqual(run(changed).layout, expected(changed));
  assert.notStrictEqual(run(changed, {}).layout, run(changed).layout);
  paginator.clear();
  assert.deepEqual(run(blocks).layout, expected(blocks));
});

test('fixed geometry footnotes can reuse an unchanged layout, but never a changed note anchor', () => {
  const paginator = createIncrementalPublicationPaginator();
  const blocks: PublicationFlowBlock[] = [{ top: 0, height: 15, noteIds: ['a'] }, { top: 15, height: 20 }];
  const notes = { heights: new Map([['a', 60]]), lineHeight: 5, separatorHeight: 5 };
  const original = paginator.paginate(blocks, 100, 20, notes);
  assert.strictEqual(paginator.paginate(structuredClone(blocks), 100, 20, notes), original);
  const changed = [{ ...blocks[0]!, noteIds: [] }, { ...blocks[1]!, noteIds: ['a'] }];
  const next = paginator.paginate(changed, 100, 20, notes);
  assert.notStrictEqual(next, original);
  assert.deepEqual(next, paginatePublicationBlocks(changed, 100, 20, notes));
});

test('complex dirty-prefix pagination preserves carried notes and inserted masters after late edits', () => {
  for (const styled of [false, true]) {
    const paginator = createIncrementalPublicationPaginator();
    const key = {};
    const blocks: PublicationFlowBlock[] = Array.from({ length: 400 }, (_, i) => ({
      sectionId: 'section-' + Math.floor(i / 50), top: i * 24, height: 24,
      splittable: true, keepWithNext: i % 19 === 0,
      forcePageBreakBefore: i % 50 === 0,
      lines: [{ top: 0, height: 12, textOffset: 0, noteIds: i % 9 === 0 ? ['n' + i] : [] },
        { top: 12, height: 12, textOffset: 10 }],
      noteIds: i % 9 === 0 ? ['n' + i] : [],
      insertedPagesBefore: styled && i === 250 ? [{ id: 'plate-page', styleId: 'plate' }] : undefined,
    }));
    const heights = new Map(Array.from({ length: 45 }, (_, i) => ['n' + i * 9, 70 + (i % 4) * 15] as const));
    const notes = { heights, lineHeight: 5, separatorHeight: 5 };
    const geometry = (_index: number, section?: string, style?: string) => ({
      height: style === 'plate' ? 210 : section === 'section-3' ? 150 : 130,
      bodyHeight: style === 'plate' ? 170 : section === 'section-3' ? 110 : 90,
      topMargin: 20,
    });
    const run = (input: PublicationFlowBlock[], cold = false) => {
      const resolver = createPublicationPageMetricsResolver(geometry, 10, 20);
      const options = styled ? { key, snapshot: resolver.snapshot, restore: resolver.restore } : undefined;
      const metrics = styled ? resolver.metrics : undefined;
      const layout = cold ? paginatePublicationBlocks(input, 90, 40, notes, metrics)
        : paginator.paginate(input, 90, 40, notes, metrics, options);
      return { layout, state: resolver.snapshot() };
    };
    const first = run(blocks);
    assert.deepEqual(first, run(blocks, true));
    const changed = blocks.map((block, i) => i === 350 ? { ...block, height: 36, lines: [...block.lines!, { top: 24, height: 12, textOffset: 20 }] } : i > 350 ? { ...block, top: block.top + 12 } : block);
    heights.set('n351', 180);
    const second = run(changed);
    assert.deepEqual(second, run(changed, true));
    assert.strictEqual(second.layout.placements[0], first.layout.placements[0]);
    assert.notStrictEqual(second.layout.placements[350], first.layout.placements[350]);
    // A changed early note invalidates every checkpoint after its anchor.
    heights.set('n0', 190);
    const third = run(changed);
    assert.deepEqual(third, run(changed, true));
    assert.notStrictEqual(third.layout.placements[0], second.layout.placements[0]);
    for (const input of [changed.slice(0, 310), changed.slice(0, 20), [...changed, { top: 9612, height: 12 }], changed]) {
      assert.deepEqual(run(input), run(input, true));
    }
  }
});

test('complex prefix cache invalidates when a previously missing early footnote becomes measurable', () => {
  const paginator = createIncrementalPublicationPaginator();
  const blocks: PublicationFlowBlock[] = Array.from({ length: 120 }, (_, i) => ({
    top: i * 15, height: 15, noteIds: i === 0 ? ['missing'] : i === 100 ? ['late'] : [],
  }));
  const notes = { heights: new Map([['late', 80]]), lineHeight: 5, separatorHeight: 5 };
  const original = paginator.paginate(blocks, 100, 20, notes);
  notes.heights.set('missing', 100);
  const next = paginator.paginate(blocks, 100, 20, notes);
  assert.notStrictEqual(next.placements[0], original.placements[0]);
  assert.deepEqual(next, paginatePublicationBlocks(blocks, 100, 20, notes));
});

test('worker-safe pagination engine produces the same styled page layout and compact hierarchy', () => {
  const style = clonePublicationStyleTemplate();
  style.pageStyles = { version: 1, styles: [], sections: [], pages: [] };
  const source = [{ id: 's', title: 'Private body title', blocks: [{ id: 'p', type: 'paragraph' as const, content: 'Private manuscript body' }] }];
  const sections = publicationWorkerSections(source);
  assert.equal(sections[0]?.title, '');
  assert.deepEqual(sections[0]?.blocks, []);
  const config = { style, sections, scale: 1, pageGap: 20, topMargin: 20, usablePageHeight: 100, pageOverhead: 40 };
  const engine = createPublicationPaginationEngine(config);
  const blocks: PublicationFlowBlock[] = [{ sectionId: 's', top: 0, height: 50, noteIds: ['a'] },
    { sectionId: 's', top: 50, height: 60, insertedPagesBefore: [{ id: 'blank' }] }];
  const notes = { heights: new Map([['a', 80]]), lineHeight: 5, separatorHeight: 5 };
  const resolver = createPublicationPageMetricsResolver((index, section, inserted) =>
    canvasPageGeometry(resolvePublicationPageStyle(style, sections, index, section, inserted), config.scale), config.pageGap, config.topMargin);
  const expected = paginatePublicationBlocks(blocks, 100, 40, notes, resolver.metrics);
  const actual = engine(blocks, notes);
  assert.deepEqual(actual.layout, expected);
  assert.deepEqual(actual.metricsState, resolver.snapshot());
  assert.strictEqual(engine(structuredClone(blocks), notes).layout, actual.layout);
});

test('publication worker client reuses one worker and falls back on failure or cancellation', async () => {
  const style = clonePublicationStyleTemplate();
  const config = { style, sections: [], scale: 1, pageGap: 20, topMargin: 20, usablePageHeight: 100, pageOverhead: 40 };
  const engine = createPublicationPaginationEngine(config);
  let configured = 0, created = 0, terminated = 0, fail = false, hang = false;
  const factory = (): PublicationWorkerPort => {
    created += 1;
    const port: PublicationWorkerPort = {
      onmessage: null, onerror: null, onmessageerror: null,
      postMessage(message: PublicationWorkerRequest) {
        if (message.kind === 'configure') { configured += 1; return; }
        if (hang) return;
        const response: PublicationWorkerResponse = fail ? { id: message.id, failed: true }
          : { id: message.id, result: engine(message.blocks, message.footnotes) };
        queueMicrotask(() => port.onmessage?.({ data: response } as MessageEvent<PublicationWorkerResponse>));
      },
      terminate() { terminated += 1; },
    };
    return port;
  };
  const client = createPublicationPaginationWorkerClient(config, factory, 100);
  const blocks = [{ top: 0, height: 30 }];
  const notes = { heights: new Map<string, number>(), lineHeight: 5, separatorHeight: 5 };
  assert.deepEqual(await client.paginate(blocks, notes), engine(blocks, notes));
  assert.ok(await client.paginate(blocks, notes));
  assert.equal(created, 1); assert.equal(configured, 1);
  fail = true;
  assert.equal(await client.paginate(blocks, notes), null);
  assert.equal(terminated, 1);
  assert.equal(await client.paginate(blocks, notes), null);
  const cancelled = createPublicationPaginationWorkerClient(config, factory, 100);
  hang = true;
  const pending = cancelled.paginate(blocks, notes);
  cancelled.close();
  assert.equal(await pending, null);
  const unavailable = createPublicationPaginationWorkerClient(config, () => { throw new Error('Worker unavailable'); });
  assert.equal(await unavailable.paginate(blocks, notes), null);
});
