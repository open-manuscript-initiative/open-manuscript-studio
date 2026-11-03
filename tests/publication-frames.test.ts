import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createFrameLayout, DEFAULT_FRAME_STYLE, FRAME_LAYOUT_EXTENSION, flowFrameStories, frameLineIntervals,
  frameStyle, frameDisplayText, getFrameLayout, linkFrames, RECTANGLE_POINTS, removeFrame, unlinkFrames, validateFrameLayout,
  type PublicationFrame, type PublicationFrameLayout,
} from '../src/model/publicationFrames.ts';
import { renderFrameDocument } from '../src/services/publicationFrameRendering.ts';
import { serializeOmiJson } from '../src/services/exportOmi.ts';
import { parseOmiJson } from '../src/services/omiPortableFormat.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
function frame(id: string, storyId: string): PublicationFrame {
  return { id, name: id, kind: 'text', page: 0, xMm: 10, yMm: 10, widthMm: 35, heightMm: 25,
    rotation: 0, shape: 'rectangle', points: structuredClone(RECTANGLE_POINTS), styleId: 'frame-style-default', storyId };
}
function fixture(): PublicationFrameLayout {
  const value = createFrameLayout();
  value.stories = [{ id: 'story-a', name: 'A', text: 'Words flow through linked frames. '.repeat(8) }, { id: 'story-b', name: 'B', text: 'Tail paragraph.\n👩🏽‍💻 é final text.' }];
  value.frames = [frame('a', 'story-a'), { ...frame('b', 'story-b'), xMm: 55 }]; return value;
}
const measure = (text: string) => [...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(text)].length;

test('link/unlink preserve every character and keep a single chain per story', () => {
  const layout = fixture(); const joinedText = layout.stories.map((item) => item.text).join('');
  const linked = linkFrames(layout, 'a', 'b');
  assert.equal(layout.stories.length, 2); assert.equal(linked.stories.length, 1);
  const flowed = flowFrameStories(linked, measure);
  assert.ok(flowed.frames[0]!.end > 0);
  assert.equal(flowed.frames[1]!.start, flowed.frames[0]!.end);
  const split = unlinkFrames(linked, 'a', flowed.frames[0]!.end, 'split');
  assert.equal(split.stories.map((item) => item.text).join(''), joinedText);
  assert.equal(split.frames[0]!.nextFrameId, undefined); assert.equal(split.frames[1]!.storyId, 'split');
  assert.equal(linkFrames(split, 'a', 'b').stories[0]!.text, joinedText);
});
test('cycles, invalid links and disconnected stories are rejected', () => {
  const layout = linkFrames(fixture(), 'a', 'b');
  assert.throws(() => linkFrames(layout, 'b', 'a'));
  const cyclic = structuredClone(layout); cyclic.frames[1]!.nextFrameId = 'a';
  assert.throws(() => validateFrameLayout(cyclic), /cyclic/);
  const disconnected = structuredClone(layout); delete disconnected.frames[0]!.nextFrameId;
  assert.throws(() => validateFrameLayout(disconnected), /disconnected/);
  const bad = structuredClone(layout); bad.frames[0]!.rotation = NaN;
  assert.throws(() => validateFrameLayout(bad), /invalid frame/);
});
test('shared formatting cascades while local overrides stay local', () => {
  const layout = fixture(); layout.styles[0]!.properties.fontSizePt = 13;
  layout.frames[1]!.overrides = { fontSizePt: 9, color: '#aabbcc' };
  assert.equal(frameStyle(layout, layout.frames[0]!).fontSizePt, 13);
  assert.equal(frameStyle(layout, layout.frames[1]!).fontSizePt, 9);
  assert.equal(frameStyle(layout, layout.frames[0]!).color, DEFAULT_FRAME_STYLE.color);
});
test('ellipse and concave polygon flow use only intervals inside the complete line band', () => {
  const f = frame('shape', 'story'); f.widthMm = 100; f.heightMm = 100; f.shape = 'ellipse';
  const middle = frameLineIntervals(f, 45, 5, 3)[0]!;
  const top = frameLineIntervals(f, 5, 5, 3)[0]!;
  assert.ok(middle[1] - middle[0] > top[1] - top[0]);
  f.shape = 'polygon'; f.points = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 70, y: 100 }, { x: 70, y: 30 }, { x: 30, y: 30 }, { x: 30, y: 100 }, { x: 0, y: 100 }];
  assert.deepEqual(frameLineIntervals(f, 50, 5, 2), [[2, 28], [72, 98]]);
  assert.deepEqual(frameLineIntervals(f, 98, 5, 2), []);
});
test('flow offsets stay on grapheme boundaries and no text disappears on overflow or deletion', () => {
  const layout = fixture(); layout.stories = [{ id: 'emoji', name: 'Emoji', text: '👩🏽‍💻é'.repeat(200) }];
  layout.frames = [{ ...frame('a', 'emoji'), widthMm: 8 }];
  const flow = flowFrameStories(layout, measure);
  const boundaries = new Set([...new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(layout.stories[0]!.text)].map((item) => item.index));
  assert.ok(flow.overflow.length);
  for (const line of flow.frames[0]!.lines) assert.ok(boundaries.has(line.start));
  const removed = removeFrame(layout, 'a');
  assert.equal(removed.stories[0]!.text, layout.stories[0]!.text);
  assert.equal(flowFrameStories(removed, measure).overflow[0]!.offset, 0);
});
test('frame state, styles, polygon points and chain links survive canonical OMI save/reopen', () => {
  const manuscript = createVersionedTestManuscript(); const layout = linkFrames(fixture(), 'a', 'b');
  layout.frames[0]!.rotation = 37.5; layout.frames[0]!.shape = 'polygon';
  manuscript.extensions = { ...manuscript.extensions, [FRAME_LAYOUT_EXTENSION]: layout };
  assert.deepEqual(getFrameLayout(parseOmiJson(serializeOmiJson(manuscript))), layout);
  const broken = JSON.parse(serializeOmiJson(manuscript)); broken.extensions[FRAME_LAYOUT_EXTENSION].frames[0].nextFrameId = 'missing';
  assert.throws(() => parseOmiJson(JSON.stringify(broken)), /invalid frame link/);
});
test('frame HTML keeps arbitrary angles and independent pages; overset output is blocked', () => {
  const layout = fixture(); layout.stories.forEach((item) => { item.text = 'Short text.'; });
  layout.frames[0]!.rotation = 23.75; layout.page.count = 2; layout.frames[1]!.page = 1;
  const html = renderFrameDocument(layout, flowFrameStories(layout, measure), new Map(), 'Title <unsafe>');
  assert.match(html, /rotate\(23.75deg\)/); assert.match(html, /Title &lt;unsafe&gt;/);
  assert.equal((html.match(/<section class="omi-frame-page"/g) ?? []).length, 2);
  const overset = fixture();
  assert.throws(() => renderFrameDocument(overset, flowFrameStories(overset, measure), new Map(), 'X'), /overflow/);
});

test('font names and titles cannot escape frame export markup', () => {
  const layout = fixture(); layout.stories.forEach((story) => { story.text = 'Safe text.'; });
  layout.styles[0]!.properties.fontFamily = '</style><script>alert(1)</script>';
  const html = renderFrameDocument(layout, flowFrameStories(layout, measure), new Map(), '<img src=x onerror=alert(1)>');
  assert.doesNotMatch(html, /<script|<img src=x/);
  assert.match(html, /&lt;img/);
});

test('tabs have consistent measured/display width without changing stored story text', () => {
  const layout = fixture(); layout.stories = [{ id: 'tabs', name: 'Tabs', text: 'Alpha\tBeta' }];
  layout.frames = [{ ...frame('tabs-frame', 'tabs'), widthMm: 100 }];
  const flow = flowFrameStories(layout, measure);
  assert.equal(flow.frames[0]!.lines[0]!.text, 'Alpha\tBeta');
  assert.equal(frameDisplayText(flow.frames[0]!.lines[0]!.text), 'Alpha    Beta');
  assert.equal(flow.overflow.length, 0);
});
