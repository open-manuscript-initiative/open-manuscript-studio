import assert from 'node:assert/strict';
import test from 'node:test';
import { collectPublicationCharacters, mappedCodePoints, checkLocalPublicationFontCoverage } from '../src/services/publicationFontCoverage.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

/** Minimal SFNT containing a single Unicode cmap subtable. */
function font(format: 4 | 12, subtable: Uint8Array): ArrayBuffer {
  const result = new ArrayBuffer(40 + subtable.length);
  const d = new DataView(result);
  d.setUint32(0, 0x00010000);
  d.setUint16(4, 1);
  d.setUint32(12, 0x636d6170);
  d.setUint32(20, 28);
  d.setUint32(24, 12 + subtable.length);
  d.setUint16(30, 1);
  d.setUint16(32, 3);
  d.setUint16(34, format === 4 ? 1 : 10);
  d.setUint32(36, 12);
  new Uint8Array(result).set(subtable, 40);
  return result;
}
test('cmap12 distinguishes non-BMP characters, absent characters and glyph zero', () => {
  const sub = new Uint8Array(40), d = new DataView(sub.buffer);
  d.setUint16(0, 12); d.setUint32(4, 40); d.setUint32(12, 2);
  d.setUint32(16, 0x41); d.setUint32(20, 0x41); d.setUint32(24, 0);
  d.setUint32(28, 0x1d400); d.setUint32(32, 0x1d401); d.setUint32(36, 20);
  assert.deepEqual([...mappedCodePoints(font(12, sub), new Set([0x41, 0x42, 0x1d400, 0x1d401, 0x1d402]))], [0x1d400, 0x1d401]);
});
test('cmap4 handles delta and glyph-array mappings including glyph zero', () => {
  const sub = new Uint8Array(36), d = new DataView(sub.buffer);
  d.setUint16(0, 4); d.setUint16(2, 36); d.setUint16(6, 4);
  d.setUint16(14, 0x42); d.setUint16(16, 0xffff);
  d.setUint16(20, 0x41); d.setUint16(22, 0xffff);
  d.setUint16(24, 1); d.setUint16(26, 1);
  d.setUint16(28, 4); d.setUint16(30, 0);
  d.setUint16(32, 0); d.setUint16(34, 7);
  assert.deepEqual([...mappedCodePoints(font(4, sub), new Set([0x41, 0x42, 0x43, 0xffff]))], [0x42]);
  d.setUint16(28, 0);
  assert.deepEqual([...mappedCodePoints(font(4, sub), new Set([0x41, 0x42]))], [0x41, 0x42]);
});
test('unsupported or truncated fonts are not reported as verified missing coverage', () => {
  assert.throws(() => mappedCodePoints(new ArrayBuffer(4), new Set([65])));
  const sub = new Uint8Array(16), d = new DataView(sub.buffer);
  d.setUint16(0, 12); d.setUint32(4, 16); d.setUint32(12, 2);
  assert.throws(() => mappedCodePoints(font(12, sub), new Set([65])));
});
test('collects unique Unicode code points per location, including combining and supplementary characters', async () => {
  const manuscript = createTestManuscript();
  const block = manuscript.sections[0]!.blocks[0]!;
  block.content = JSON.stringify({ type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'αα שָ 𝐀\u200d\uFE0F' }] }] });
  const result = collectPublicationCharacters(manuscript).filter(item => item.blockId === block.id);
  assert.deepEqual(result.map(item => item.codePoint), [0x3b1, 0x5e9, 0x5b8, 0x1d400]);
  const unavailable = await checkLocalPublicationFontCoverage(result);
  assert.equal(unavailable.status, 'unavailable');
  assert.deepEqual(unavailable.missing, []);
});
