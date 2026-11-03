import assert from 'node:assert/strict';
import test from 'node:test';
import { createDefaultFlowFrameLayout, paginateAutomaticFrameLayout } from '../src/model/publicationAutoFlow.ts';
import {
  defaultFramePageStyle, deleteFramePage, frameGraphicContentStyle, frameGraphicInnerStyle, frameGraphicTransform,
  framePages, framePageStyle, frameRunningHeader, insertFramePage, updateFrameGraphicSize, withFramePages,
} from '../src/model/publicationFramePages.ts';
import { createFrameLayout, flowFrameStories, FRAME_LAYOUT_EXTENSION, getFrameLayout, RECTANGLE_POINTS, validateFrameLayout, type PublicationFrame } from '../src/model/publicationFrames.ts';
import { renderFrameDocument } from '../src/services/publicationFrameRendering.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
function textFrame(id: string, page: number): PublicationFrame { return { id, name: id, kind: 'text', storyId: 'story', page, xMm: 20, yMm: 20, widthMm: 70, heightMm: 80, rotation: 0, shape: 'rectangle', points: structuredClone(RECTANGLE_POINTS), styleId: 'frame-style-default' }; }

test('legacy page counts acquire stable assignments without changing frame geometry', () => {
  const legacy = createFrameLayout(); legacy.page.count = 2;
  const pages = framePages(legacy); assert.equal(pages.length, 2);
  const next = withFramePages(legacy);
  assert.deepEqual(framePages(next), pages); assert.equal(framePageStyle(next, 1).widthMm, 150);
  assert.equal(legacy.pages, undefined); validateFrameLayout(next);
});
test('inserting a selected page style shifts placements and deleting reconnects stories without losing text', () => {
  let layout = withFramePages(createFrameLayout());
  layout.pageStyles!.push({ ...defaultFramePageStyle(240, 150), id: 'landscape', name: 'Landscape' });
  layout = insertFramePage(layout, 0, 'landscape', 'page-2');
  layout = insertFramePage(layout, 1, 'landscape', 'page-3');
  layout.stories = [{ id: 'story', name: 'Story', text: 'Complete retained story.' }];
  layout.frames = [textFrame('a', 0), textFrame('b', 1), textFrame('c', 2)];
  layout.frames[0]!.nextFrameId = 'b'; layout.frames[1]!.nextFrameId = 'c';
  validateFrameLayout(layout);
  const next = deleteFramePage(layout, 1);
  assert.equal(next.page.count, 2); assert.equal(next.frames[0]!.nextFrameId, 'c');
  assert.equal(next.frames[1]!.page, 1); assert.equal(next.stories[0]!.text, layout.stories[0]!.text);
  assert.equal(framePageStyle(next, 1).id, 'landscape'); validateFrameLayout(next);
  const inserted = insertFramePage(next, 0, 'landscape', 'inserted');
  assert.equal(inserted.frames[1]!.page, 2); assert.equal(inserted.pages![2]!.id, 'page-3');
  assert.throws(() => deleteFramePage(createFrameLayout(), 0), /at least one/);
});
test('page deletion retains orphan stories for recovery and overflow reporting', () => {
  const layout = insertFramePage(withFramePages(createFrameLayout()), 0, 'frame-page-style-default', 'second');
  layout.stories = [{ id: 'story', name: 'Kept', text: 'This text survives deleting its page.' }];
  layout.frames = [textFrame('only', 1)];
  const next = deleteFramePage(layout, 1);
  assert.equal(next.frames.length, 0);
  assert.equal(flowFrameStories(next, (text) => text.length).overflow[0]!.text, layout.stories[0]!.text);
});
test('running headers resolve page counters, first-page visibility and distinct even pages', () => {
  let layout = withFramePages(createFrameLayout()); layout.pageNumberStart = 12;
  layout = insertFramePage(layout, 0, layout.pageStyles![0]!.id, 'second');
  const header = layout.pageStyles![0]!.runningHeader;
  header.enabled = true; header.differentEvenPages = true;
  header.odd = { left: '{title}', center: '{page}/{pages}', right: '{style}' };
  header.even = { left: 'Even {page}', center: '{articleTitle}', right: '{pageNumber}' };
  assert.equal(frameRunningHeader(layout, 0, 'Title')!.left, 'Even 12');
  assert.equal(frameRunningHeader(layout, 1, 'Title')!.center, '13/2');
  header.showFirstPage = false; assert.equal(frameRunningHeader(layout, 0, 'Title'), undefined);
});
test('graphic sizing preserves a selected ratio or independently distorts either dimension', () => {
  const frame: PublicationFrame = { ...textFrame('graphic', 0), kind: 'graphic' as const, storyId: undefined, sourceBlockId: 'image' };
  let graphic = frameGraphicTransform(frame, 2);
  assert.equal(graphic.widthMm / graphic.heightMm, 2);
  const originalHeight = graphic.heightMm;
  graphic = updateFrameGraphicSize(graphic, 'widthMm', graphic.widthMm * 2);
  assert.equal(graphic.heightMm, originalHeight * 2);
  const free = updateFrameGraphicSize({ ...graphic, keepAspectRatio: false }, 'heightMm', 13);
  assert.equal(free.widthMm, graphic.widthMm); assert.equal(free.heightMm, 13);
  frame.graphicTransform = { ...free, rotation: 28.75, offsetXMm: -12, offsetYMm: 4 };
  assert.equal(frameGraphicContentStyle(frame).transform, 'rotate(28.75deg)');
  assert.match(frameGraphicInnerStyle(frame).transform, /^scale\(/);
  assert.equal(frame.widthMm, 70);
});
test('page styles and transformed graphics survive OMI save/reopen and reject malformed values', () => {
  const manuscript = createVersionedTestManuscript();
  let layout = withFramePages(createFrameLayout());
  layout.pageStyles!.push({ ...defaultFramePageStyle(240, 150), id: 'second-style', name: 'Custom' });
  layout = insertFramePage(layout, 0, 'second-style', 'second');
  const frame: PublicationFrame = { ...textFrame('g', 1), kind: 'graphic' as const, storyId: undefined, sourceBlockId: 'image' };
  frame.graphicTransform = { ...frameGraphicTransform(frame, 2), offsetXMm: -17, rotation: -31.5, keepAspectRatio: false };
  layout.frames = [frame]; manuscript.extensions = { [FRAME_LAYOUT_EXTENSION]: layout };
  assert.deepEqual(getFrameLayout(parseOmiJson(serializeOmiJson(manuscript))), JSON.parse(JSON.stringify(layout)));
  const bad = structuredClone(layout); bad.frames[0]!.graphicTransform!.widthMm = 0;
  assert.throws(() => validateFrameLayout(bad), /graphic transform/);
  const badStyle = structuredClone(layout); badStyle.pages![0]!.styleId = 'missing';
  assert.throws(() => validateFrameLayout(badStyle), /page styles/);
});
test('fixed-layout export includes named mixed-size pages, escaped headers and graphic clipping', () => {
  let layout = withFramePages(createFrameLayout());
  layout.pageStyles![0]!.runningHeader.enabled = true;
  layout.pageStyles!.push({ ...defaultFramePageStyle(240, 150), id: 'wide', name: 'Wide' });
  layout = insertFramePage(layout, 0, 'wide', 'second');
  const frame: PublicationFrame = { ...textFrame('g', 0), kind: 'graphic' as const, storyId: undefined, sourceBlockId: 'image' };
  frame.graphicTransform = { ...frameGraphicTransform(frame, 2), rotation: 17, offsetXMm: -5 };
  layout.frames = [frame];
  for (const tag of ['script', 'SCRIPT', 'ScRiPt']) {
    layout.pageStyles![0]!.runningHeader.odd.left = `{title} <${tag}>x</${tag}>`;
    const html = renderFrameDocument(layout, flowFrameStories(layout, (text) => text.length), new Map([['image', '<figure><svg></svg></figure>']]), 'Title');
    assert.match(html, /@page omi_frame_style_1\{size:240mm 150mm/);
    assert.match(html, /omi-frame-running-header/); assert.doesNotMatch(html, /<script\b/i);
    assert.match(html, /&lt;script&gt;/i); assert.match(html, /rotate\(17deg\)/);
    assert.match(html, /\.omi-frame-graphic\{position:absolute;inset:0;overflow:hidden\}/);
  }
});

const monospacedMeasure = (text: string) => text.length * 2;

test('new unified frame layout starts on A4 with a 25 mm editable content frame', () => {
  const layout = createDefaultFlowFrameLayout();
  const page = framePageStyle(layout, 0);
  assert.deepEqual([page.widthMm, page.heightMm], [210, 297]);
  assert.deepEqual(page.margins, { top: 25, right: 25, bottom: 25, left: 25 });
  assert.equal(layout.page.count, 1);
  assert.deepEqual([layout.frames[0]!.xMm, layout.frames[0]!.yMm, layout.frames[0]!.widthMm, layout.frames[0]!.heightMm], [25, 25, 160, 247]);
  assert.equal(layout.frames[0]!.storyId, layout.autoFlowStoryId);
  validateFrameLayout(layout);
});

test('automatic continuation allocates linked pages with no missing characters', () => {
  const layout = createDefaultFlowFrameLayout();
  const content = 'Long paragraph with space. '.repeat(500);
  layout.stories[0]!.text = content;
  const next = paginateAutomaticFrameLayout(layout, monospacedMeasure);
  assert.ok(next.page.count > 1);
  assert.equal(next.frames.length, next.page.count);
  assert.equal(flowFrameStories(next, monospacedMeasure).overflow.length, 0);
  assert.equal(next.stories[0]!.text, content);
  assert.ok(next.frames.slice(1).every((frame) => frame.autoGenerated && frame.kind === 'text'));
  const offsets = flowFrameStories(next, monospacedMeasure).frames;
  for (let i = 1; i < offsets.length; i += 1) {
    assert.equal(offsets[i]!.start, offsets[i - 1]!.end);
    assert.equal(next.frames[i - 1]!.nextFrameId, next.frames[i]!.id);
  }
  validateFrameLayout(next);
});

test('continuation follows a resized first frame and retains manual frames and page styles', () => {
  const layout = createDefaultFlowFrameLayout();
  layout.frames[0]!.widthMm = 90;
  layout.frames[0]!.heightMm = 140;
  layout.frames[0]!.xMm = 31;
  layout.frames[0]!.rotation = 12;
  layout.stories[0]!.text = 'text '.repeat(1500);
  const next = paginateAutomaticFrameLayout(layout, monospacedMeasure);
  assert.ok(next.page.count > 1);
  assert.ok(next.frames.slice(1).every((frame) => frame.xMm === 31 && frame.widthMm === 90 && frame.rotation === 12));
  assert.equal(flowFrameStories(next, monospacedMeasure).overflow.length, 0);
  assert.deepEqual(framePageStyle(next, next.page.count - 1).margins, framePageStyle(layout, 0).margins);
});

test('reducing content prunes only empty generated continuation pages', () => {
  const layout = createDefaultFlowFrameLayout();
  layout.stories[0]!.text = 'word '.repeat(1800);
  const grown = paginateAutomaticFrameLayout(layout, monospacedMeasure);
  assert.ok(grown.page.count > 1);
  grown.stories[0]!.text = 'Short.';
  const shrunk = paginateAutomaticFrameLayout(grown, monospacedMeasure);
  assert.equal(shrunk.page.count, 1);
  assert.equal(shrunk.frames.length, 1);
  assert.equal(shrunk.stories[0]!.text, 'Short.');
  validateFrameLayout(shrunk);
});

test('too-narrow text frame reports overflow without creating empty pages', () => {
  const layout = createDefaultFlowFrameLayout();
  layout.frames[0]!.widthMm = 5;
  layout.styles[0]!.properties.paddingMm = 3;
  layout.stories[0]!.text = 'This text cannot fit.';
  const next = paginateAutomaticFrameLayout(layout, monospacedMeasure);
  assert.equal(next.page.count, 1);
  assert.equal(flowFrameStories(next, monospacedMeasure).overflow[0]!.text, layout.stories[0]!.text);
});

test('automatic frame metadata survives portable OMI round-trip', () => {
  const manuscript = createVersionedTestManuscript();
  const layout = createDefaultFlowFrameLayout();
  layout.stories[0]!.text = 'word '.repeat(2000);
  manuscript.extensions = { ...manuscript.extensions, [FRAME_LAYOUT_EXTENSION]: paginateAutomaticFrameLayout(layout, monospacedMeasure) };
  const roundTrip = getFrameLayout(parseOmiJson(serializeOmiJson(manuscript)));
  assert.deepEqual(roundTrip, manuscript.extensions[FRAME_LAYOUT_EXTENSION]);
  validateFrameLayout(roundTrip);
});

test('generated frames inherit subsequent default-frame edits without replacing customized frames', () => {
  const layout = createDefaultFlowFrameLayout();
  layout.stories[0]!.text = 'text '.repeat(1300);
  const grown = paginateAutomaticFrameLayout(layout, monospacedMeasure);
  assert.ok(grown.frames.length >= 3);
  grown.frames[0]!.widthMm = 110;
  grown.frames[0]!.xMm = 32;
  const updated = paginateAutomaticFrameLayout(grown, monospacedMeasure);
  assert.equal(updated.frames[1]!.widthMm, 110);
  assert.equal(updated.frames[1]!.xMm, 32);
  updated.frames[1]!.autoGenerated = false;
  updated.frames[1]!.widthMm = 80;
  updated.frames[0]!.widthMm = 105;
  const customized = paginateAutomaticFrameLayout(updated, monospacedMeasure);
  assert.equal(customized.frames[1]!.widthMm, 80);
  assert.ok(customized.frames.slice(2).filter((frame) => frame.autoGenerated).every((frame) => frame.widthMm === 105));
  validateFrameLayout(customized);
});
