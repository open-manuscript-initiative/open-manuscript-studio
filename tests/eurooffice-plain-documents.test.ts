import assert from 'node:assert/strict';
import test from 'node:test';
import { inflateRawSync } from 'node:zlib';
import { createBlankDocx } from '../server/src/integrations/eurooffice/blankDocx.ts';

test('EuroOffice blank-document package is a valid DOCX with the requested title', async () => {
  const bytes = createBlankDocx('Székely <jegyzet> & más');
  assert.equal(Buffer.from(bytes).subarray(0, 4).toString('hex'), '504b0304');

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let endOffset = -1;
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 0xffff - 22); offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) { endOffset = offset; break; }
  }
  assert.notEqual(endOffset, -1, 'DOCX has a ZIP end-of-central-directory record');
  const count = view.getUint16(endOffset + 10, true);
  let centralOffset = view.getUint32(endOffset + 16, true);
  const files = new Map<string, Buffer>();
  for (let index = 0; index < count; index += 1) {
    const nameLength = view.getUint16(centralOffset + 28, true);
    const extraLength = view.getUint16(centralOffset + 30, true);
    const commentLength = view.getUint16(centralOffset + 32, true);
    const name = new TextDecoder().decode(bytes.subarray(centralOffset + 46, centralOffset + 46 + nameLength));
    const compressedSize = view.getUint32(centralOffset + 20, true);
    const localOffset = view.getUint32(centralOffset + 42, true);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + localNameLength + localExtraLength;
    files.set(name, inflateRawSync(bytes.subarray(dataStart, dataStart + compressedSize)));
    centralOffset += 46 + nameLength + extraLength + commentLength;
  }
  assert.ok(files.has('word/document.xml'));
  assert.match(files.get('word/document.xml')!.toString('utf8'), /<w:body>/);
  assert.match(files.get('docProps/core.xml')!.toString('utf8'), /Székely &lt;jegyzet&gt; &amp; más/);
});
