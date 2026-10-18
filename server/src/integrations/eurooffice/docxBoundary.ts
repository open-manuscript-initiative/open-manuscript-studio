import { inflateRawSync } from 'node:zlib';
import { XmlDocument, ParseOption } from 'libxml2-wasm';

export const MAX_DOCX_BYTES = 25 * 1024 * 1024;
const MAX_EXPANDED = 100 * 1024 * 1024;
const MAX_PART = 25 * 1024 * 1024;

export async function readBoundedDocx(response: Response): Promise<Buffer> {
  if (!response.ok) { await response.body?.cancel(); throw new Error('DOCX_DOWNLOAD_FAILED'); }
  if (Number(response.headers.get('content-length')) > MAX_DOCX_BYTES) {
    await response.body?.cancel(); throw new Error('DOCX_TOO_LARGE');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('DOCX_EMPTY');
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_DOCX_BYTES) throw new Error('DOCX_TOO_LARGE');
      chunks.push(value);
    }
  } finally { await reader.cancel().catch(() => undefined); reader.releaseLock(); }
  const bytes = Buffer.concat(chunks, size);
  validateDocxPackage(bytes);
  return bytes;
}

function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function check(condition: unknown): asserts condition {
  if (!condition) throw new Error('INVALID_DOCX_PACKAGE');
}

/** Bounded ZIP integrity plus required OPC/XML parts; not a claim of OOXML schema conformance. */
export function validateDocxPackage(bytes: Buffer): void {
  check(bytes.length >= 22 && bytes.length <= MAX_DOCX_BYTES);
  let end = -1;
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (bytes.readUInt32LE(i) === 0x06054b50 && i + 22 + bytes.readUInt16LE(i + 20) === bytes.length) { end = i; break; }
  }
  check(end >= 0);
  check(bytes.readUInt16LE(end + 4) === 0 && bytes.readUInt16LE(end + 6) === 0);
  const count = bytes.readUInt16LE(end + 10);
  check(count > 0 && count <= 4096 && bytes.readUInt16LE(end + 8) === count);
  const centralSize = bytes.readUInt32LE(end + 12), centralStart = bytes.readUInt32LE(end + 16);
  check(centralStart + centralSize === end);
  let cursor = centralStart, expanded = 0;
  const parts = new Map<string, Buffer>();
  const ranges: Array<[number, number]> = [];
  for (let index = 0; index < count; index++) {
    check(cursor + 46 <= end && bytes.readUInt32LE(cursor) === 0x02014b50);
    const flags = bytes.readUInt16LE(cursor + 8), method = bytes.readUInt16LE(cursor + 10);
    const crc = bytes.readUInt32LE(cursor + 16), packed = bytes.readUInt32LE(cursor + 20), length = bytes.readUInt32LE(cursor + 24);
    const nameLength = bytes.readUInt16LE(cursor + 28), extraLength = bytes.readUInt16LE(cursor + 30), commentLength = bytes.readUInt16LE(cursor + 32);
    const offset = bytes.readUInt32LE(cursor + 42), entryEnd = cursor + 46 + nameLength + extraLength + commentLength;
    check(entryEnd <= end && nameLength > 0 && bytes.readUInt16LE(cursor + 34) === 0);
    check((flags & ~0x0808) === 0 && (method === 0 || method === 8));
    check(((bytes.readUInt32LE(cursor + 38) >>> 16) & 0xf000) !== 0xa000);
    check(length <= MAX_PART && expanded + length <= MAX_EXPANDED);
    // ZIP64 is outside this adapter's bounded profile.
    let extra = cursor + 46 + nameLength;
    while (extra < cursor + 46 + nameLength + extraLength) {
      check(extra + 4 <= cursor + 46 + nameLength + extraLength);
      check(bytes.readUInt16LE(extra) !== 1);
      extra += 4 + bytes.readUInt16LE(extra + 2);
    }
    check(extra === cursor + 46 + nameLength + extraLength);
    const nameBytes = bytes.subarray(cursor + 46, cursor + 46 + nameLength);
    const name = new TextDecoder('utf-8', { fatal: true }).decode(nameBytes);
    check(!parts.has(name) && !name.includes('\\') && !name.startsWith('/') && !/[\x00-\x1f:]/.test(name));
    check(!name.split('/').some(part => part === '..' || part === '.'));
    check(offset + 30 <= centralStart && bytes.readUInt32LE(offset) === 0x04034b50);
    check(bytes.readUInt16LE(offset + 6) === flags && bytes.readUInt16LE(offset + 8) === method);
    const localNameLength = bytes.readUInt16LE(offset + 26), localExtraLength = bytes.readUInt16LE(offset + 28);
    const dataStart = offset + 30 + localNameLength + localExtraLength;
    check(dataStart + packed <= centralStart && bytes.subarray(offset + 30, offset + 30 + localNameLength).equals(nameBytes));
    if (!(flags & 8)) check(bytes.readUInt32LE(offset + 14) === crc && bytes.readUInt32LE(offset + 18) === packed && bytes.readUInt32LE(offset + 22) === length);
    let dataEnd = dataStart + packed;
    if (flags & 8) {
      if (dataEnd + 4 <= centralStart && bytes.readUInt32LE(dataEnd) === 0x08074b50) dataEnd += 4;
      check(dataEnd + 12 <= centralStart && bytes.readUInt32LE(dataEnd) === crc && bytes.readUInt32LE(dataEnd + 4) === packed && bytes.readUInt32LE(dataEnd + 8) === length);
      dataEnd += 12;
    }
    check(!ranges.some(([a,b]) => offset < b && dataEnd > a));
    ranges.push([offset, dataEnd]);
    const compressed = bytes.subarray(dataStart, dataStart + packed);
    const result = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.min(MAX_PART, MAX_EXPANDED - expanded) });
    check(result.length === length && crc32(result) === crc);
    expanded += result.length;
    parts.set(name, result);
    cursor = entryEnd;
  }
  check(cursor === end);
  for (const name of ['[Content_Types].xml', '_rels/.rels', 'word/document.xml']) check(parts.has(name));
  for (const [name, data] of parts) {
    if (!name.endsWith('.xml') && !name.endsWith('.rels')) continue;
    const xml = new TextDecoder('utf-8', { fatal: true }).decode(data);
    check(!/<!\s*(DOCTYPE|ENTITY)\b/i.test(xml));
    const document = XmlDocument.fromString(xml, { option: ParseOption.XML_PARSE_NONET | ParseOption.XML_PARSE_NO_SYS_CATALOG });
    try { check(document.root !== null); } finally { document.dispose(); }
  }
  const contentTypes = parts.get('[Content_Types].xml')!.toString('utf8');
  check(contentTypes.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml'));
  check(parts.get('_rels/.rels')!.toString('utf8').includes('officeDocument'));
  check(/<(?:\w+:)?document\b/.test(parts.get('word/document.xml')!.toString('utf8')));
}
