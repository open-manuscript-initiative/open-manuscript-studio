import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { createStoreZip, textZipEntry } from '../src/services/simpleZip.ts';
import { parseOdtForStudio } from '../src/services/odtImport.ts';
import { buildOdtExport } from '../src/services/exportOdt.ts';
import { createImageBlock } from '../src/model/visualBlocks.ts';
import { createTestManuscript } from './testManuscriptFixture.ts';

test('imports ODT title, heading hierarchy, inline semantics, table and notes', async () => {
  const content = `<?xml version="1.0"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0" xmlns:xlink="http://www.w3.org/1999/xlink"><office:body><office:text><text:h text:outline-level="1">Methods</text:h><text:p>Plain <text:span text:style-name="Strong">bold</text:span><text:note text:note-class="footnote"><text:note-citation>1</text:note-citation><text:note-body><text:p>A note.</text:p></text:note-body></text:note></text:p><text:list><text:list-item><text:p>Listed item</text:p></text:list-item></text:list><table:table><table:table-row><table:table-cell><text:p>Head</text:p></table:table-cell><table:table-cell><text:p>Value</text:p></table:table-cell></table:table-row></table:table></office:text></office:body></office:document-content>`;
  const meta = `<?xml version="1.0"?><office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"><office:meta><dc:title>ODT title</dc:title><dc:language>hu-HU</dc:language><dc:creator>Ada Scholar</dc:creator><meta:keyword>Open format</meta:keyword></office:meta></office:document-meta>`;
  const bytes = createStoreZip([textZipEntry('mimetype', 'application/vnd.oasis.opendocument.text'), textZipEntry('content.xml', content), textZipEntry('meta.xml', meta)]);
  const file = new File([bytes], 'test.odt', { type: 'application/vnd.oasis.opendocument.text' });
  const plan = await parseOdtForStudio(file);
  assert.equal(plan.title, 'ODT title');
  assert.equal(plan.locale, 'hu-HU');
  assert.equal(plan.authors[0]?.displayName, 'Ada Scholar');
  assert.equal(plan.keywords[0], 'Open format');
  assert.equal(plan.sections[0]?.title, 'Methods');
  assert.ok(plan.sections[0]?.blocks.some((block) => block.visual?.kind === 'table'));
  assert.equal(plan.stats.lists, 1);
  assert.ok(plan.sections[0]?.blocks.some((block) => block.content.includes('"type":"bulletList"')));
  assert.equal(plan.annotations.length, 1);
  const paragraph = plan.sections[0]?.blocks.find((block) => !block.visual && block.type === 'paragraph');
  assert.ok(paragraph?.content.includes('"type":"bold"'));
  assert.ok(paragraph?.content.includes('"type":"omiNote"'));
});

test('rejects DTD and entity declarations in untrusted ODT XML', async () => {
  const content = `<!DOCTYPE office:document-content [<!ENTITY payload "unsafe">]><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><office:body><office:text>&payload;</office:text></office:body></office:document-content>`;
  const bytes = createStoreZip([
    textZipEntry('mimetype', 'application/vnd.oasis.opendocument.text'),
    textZipEntry('content.xml', content),
  ]);
  await assert.rejects(() => parseOdtForStudio(new File([bytes], 'unsafe.odt')), /declarations and entities are not supported/i);
});

test('exports an ODT package with the required first mimetype entry and portable manuscript content', () => {
  const manuscript = createTestManuscript();
  manuscript.sections[0]!.blocks.push(createImageBlock({ src: 'data:image/png;base64,iVBORw0KGgo=', mediaType: 'image/png', alt: 'A chart' }));
  manuscript.sections[0]!.blocks[0]!.content = JSON.stringify({ type: 'doc', content: [{ type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'List item' }] }] }] }] });
  const result = buildOdtExport(manuscript);
  const entries = unzipStore(result.bytes);
  assert.equal(entries[0]?.name, 'mimetype');
  assert.equal(decode(entries[0]!.bytes), 'application/vnd.oasis.opendocument.text');
  const content = decode(entries.find((entry) => entry.name === 'content.xml')!.bytes);
  const styles = decode(entries.find((entry) => entry.name === 'styles.xml')!.bytes);
  assert.match(content, /office:document-content/);
  assert.match(content, /office:text/);
  assert.match(content, /text:h/);
  assert.match(content, /<text:p/);
  assert.match(content, /<text:list/);
  assert.match(styles, /OMIHeading1/);
  assert.match(styles, /OMIStrong/);
  assert.ok(entries.some((entry) => entry.name === 'Pictures/image-1.png'));
});

test('imports and embeds ODT images as local OMI image objects', async () => {
  const content = `<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:draw="urn:oasis:names:tc:opendocument:xmlns:drawing:1.0" xmlns:xlink="http://www.w3.org/1999/xlink"><office:body><office:text><text:p><draw:frame><draw:image xlink:href="Pictures/pixel.png"/><svg:title xmlns:svg="urn:oasis:names:tc:opendocument:xmlns:svg-compatible:1.0">Pixel</svg:title></draw:frame></text:p></office:text></office:body></office:document-content>`;
  const bytes = createStoreZip([
    textZipEntry('mimetype', 'application/vnd.oasis.opendocument.text'),
    textZipEntry('content.xml', content),
    { name: 'Pictures/pixel.png', bytes: new Uint8Array([137, 80, 78, 71]) },
  ]);
  const plan = await parseOdtForStudio(new File([bytes], 'image.odt'));
  const image = plan.sections.flatMap((section) => section.blocks).find((block) => block.visual?.kind === 'image');
  assert.equal(image?.visual?.kind, 'image');
  if (image?.visual?.kind === 'image') {
    assert.equal(image.visual.alt, 'Pixel');
    assert.match(image.visual.src, /^data:image\/png;base64,/);
  }
  assert.equal(plan.stats.images, 1);
});

function unzipStore(bytes: Uint8Array): Array<{ name: string; bytes: Uint8Array }> {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 0xffff - 22); i--) if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  assert.notEqual(end, -1);
  const count = view.getUint16(end + 10, true); let offset = view.getUint32(end + 16, true);
  const entries: Array<{ name: string; bytes: Uint8Array }> = [];
  for (let i = 0; i < count; i++) {
    assert.equal(view.getUint32(offset, true), 0x02014b50);
    const method = view.getUint16(offset + 10, true); const compressed = view.getUint32(offset + 20, true); const nameLength = view.getUint16(offset + 28, true); const extra = view.getUint16(offset + 30, true); const comment = view.getUint16(offset + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    const local = view.getUint32(offset + 42, true); const localNameLength = view.getUint16(local + 26, true); const localExtra = view.getUint16(local + 28, true); const dataStart = local + 30 + localNameLength + localExtra;
    const payload = bytes.subarray(dataStart, dataStart + compressed);
    entries.push({ name, bytes: method === 8 ? new Uint8Array(inflateRawSync(payload)) : payload.slice() });
    offset += 46 + nameLength + extra + comment;
  }
  return entries;
}
function decode(bytes: Uint8Array): string { return new TextDecoder().decode(bytes); }
