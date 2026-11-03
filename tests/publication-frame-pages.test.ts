import assert from 'node:assert/strict';
import test from 'node:test';
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
