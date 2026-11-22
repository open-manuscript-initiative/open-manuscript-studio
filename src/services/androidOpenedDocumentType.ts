/**
 * Android document providers may supply opaque content:// URIs without an
 * extension or a useful MIME type. Inspect ZIP directory entry names, without
 * inflating untrusted content, to distinguish Word DOCX from an OMI package.
 */
export function isWordDocxPackage(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 22) return false;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (view.getUint32(0, true) !== 0x04034b50) return false;

  const minimum = Math.max(0, bytes.byteLength - 22 - 0xffff);
  for (let end = bytes.byteLength - 22; end >= minimum; end -= 1) {
    if (view.getUint32(end, true) !== 0x06054b50) continue;
    if (end + 22 + view.getUint16(end + 20, true) !== bytes.byteLength) continue;
    if (view.getUint16(end + 4, true) !== 0 || view.getUint16(end + 6, true) !== 0) continue;
    const count = view.getUint16(end + 10, true);
    if (count === 0 || count === 0xffff || view.getUint16(end + 8, true) !== count) continue;
    const start = view.getUint32(end + 16, true);
    const size = view.getUint32(end + 12, true);
    if (start > end || size !== end - start) continue;

    let offset = start;
    let hasTypes = false;
    let hasWordDocument = false;
    const decoder = new TextDecoder('utf-8', { fatal: true });
    try {
      for (let index = 0; index < count; index += 1) {
        if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) return false;
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const next = offset + 46 + nameLength + extraLength + commentLength;
        if (next > end) return false;
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        if (name === '[Content_Types].xml') hasTypes = true;
        if (name === 'word/document.xml') hasWordDocument = true;
        offset = next;
      }
    } catch {
      return false;
    }
    return offset === end && hasTypes && hasWordDocument;
  }
  return false;
}
