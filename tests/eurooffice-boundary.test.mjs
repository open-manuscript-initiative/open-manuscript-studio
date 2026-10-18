import assert from 'node:assert/strict';
import test from 'node:test';
import { deflateRawSync } from 'node:zlib';
import { createBlankDocx } from '../server/dist/integrations/eurooffice/blankDocx.js';
import { readBoundedDocx, validateDocxPackage, MAX_DOCX_BYTES } from '../server/dist/integrations/eurooffice/docxBoundary.js';

function singlePart(data, name = 'word/document.xml', declaredLength = data.length) {
  const text = Buffer.from(name), compressed = deflateRawSync(data);
  const local = Buffer.alloc(30), central = Buffer.alloc(46), end = Buffer.alloc(22);
  local.writeUInt32LE(0x04034b50); local.writeUInt16LE(8, 8); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(declaredLength, 22); local.writeUInt16LE(text.length, 26);
  central.writeUInt32LE(0x02014b50); central.writeUInt16LE(8,10); central.writeUInt32LE(compressed.length,20); central.writeUInt32LE(declaredLength,24); central.writeUInt16LE(text.length,28);
  end.writeUInt32LE(0x06054b50); end.writeUInt16LE(1,8); end.writeUInt16LE(1,10); end.writeUInt32LE(central.length + text.length,12); end.writeUInt32LE(local.length+text.length+compressed.length,16);
  return Buffer.concat([local,text,compressed,central,text,end]);
}

test('valid DOCX is preserved byte-for-byte; malformed/CRC/unsafe/missing parts are rejected', async () => {
  const bytes = createBlankDocx('Synthetic recovery fixture');
  assert.deepEqual(await readBoundedDocx(new Response(bytes)), bytes);
  const corrupted = Buffer.from(bytes); corrupted[50] ^= 255;
  for (const candidate of [Buffer.from('PK\x03\x04fake'), bytes.subarray(0,-8), corrupted,
    singlePart(Buffer.from('bad'), '../unsafe'), singlePart(Buffer.from('<document/>'))]) {
    assert.throws(() => validateDocxPackage(candidate));
  }
});

test('actual streamed-byte cap cancels absent/forged length responses before full buffering', async () => {
  for (const headers of [{}, { 'content-length': '1' }]) {
    let produced = 0, cancelled = false;
    const stream = new ReadableStream({ pull(controller) { produced++; controller.enqueue(new Uint8Array(1024*1024)); }, cancel() { cancelled = true; } });
    await assert.rejects(readBoundedDocx(new Response(stream, { headers })), /DOCX_TOO_LARGE/);
    assert.ok(produced <= 27); assert.equal(cancelled, true);
  }
  let cancelled = false;
  await assert.rejects(readBoundedDocx(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-length': String(MAX_DOCX_BYTES + 1) } })), /DOCX_TOO_LARGE/);
  assert.equal(cancelled, true);
});

test('forged deflate length cannot bypass expanded-part quota', () => {
  assert.throws(() => validateDocxPackage(singlePart(Buffer.alloc(26 * 1024 * 1024), 'bomb', 1)));
});
