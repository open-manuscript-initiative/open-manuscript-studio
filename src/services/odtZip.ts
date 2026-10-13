import { MAX_VISUAL_IMPORT_BYTES } from '../model/visualBlocks';
import { crc32 } from './simpleZip';

export const ODT_ZIP_LIMITS = { partBytes: MAX_VISUAL_IMPORT_BYTES, totalBytes: 100 * 1024 * 1024, entries: 4096 } as const;
interface Entry { method: number; size: number; compressed: number; dataStart: number; crc: number }

/** ODT-specific bounded ZIP reader. Never trust the declared expanded length as a resource limit. */
export class OdtZip {
  private readonly entries = new Map<string, Entry>();
  private readonly cache = new Map<string, Uint8Array>();
  private readonly bytes: Uint8Array;
  private expandedBytes = 0;
  private readonly limits: { partBytes: number; totalBytes: number; entries: number };
  constructor(buffer: ArrayBuffer, limits: Partial<typeof this.limits> = {}) {
    this.limits = { ...ODT_ZIP_LIMITS, ...limits };
    for (const key of ['partBytes', 'totalBytes', 'entries'] as const) {
      if (!Number.isSafeInteger(this.limits[key]) || this.limits[key] < 1 || this.limits[key] > ODT_ZIP_LIMITS[key]) throw new Error('Invalid ODT ZIP quota.');
    }
    this.bytes = new Uint8Array(buffer);
    const view = new DataView(buffer); const decoder = new TextDecoder('utf-8', { fatal: true });
    let end = -1;
    for (let i = this.bytes.length - 22; i >= Math.max(0, this.bytes.length - 0xffff - 22); i--) {
      if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === this.bytes.length) { end = i; break; }
    }
    if (end < 0) throw new Error('The ODT ZIP end-of-central-directory record is missing.');
    const count = view.getUint16(end + 10, true); const centralStart = view.getUint32(end + 16, true); const centralSize = view.getUint32(end + 12, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true) || view.getUint16(end + 8, true) !== count || count === 0xffff || centralStart === 0xffffffff || centralSize === 0xffffffff) throw new Error('Multi-disk and ZIP64 ODT packages are unsupported.');
    if (count > this.limits.entries || centralStart + centralSize !== end) throw new Error('Invalid ODT ZIP central directory or entry quota.');
    let offset = centralStart; let declaredTotal = 0; const ranges: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
      if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error('Invalid ODT ZIP central directory.');
      const nameLength = view.getUint16(offset + 28, true), extra = view.getUint16(offset + 30, true), comment = view.getUint16(offset + 32, true);
      const next = offset + 46 + nameLength + extra + comment;
      if (next > end || view.getUint16(offset + 34, true)) throw new Error('Invalid ODT ZIP entry.');
      const name = decoder.decode(this.bytes.subarray(offset + 46, offset + 46 + nameLength));
      if (!name || name.startsWith('/') || /[\\:]/u.test(name) || [...name].some(character => character.charCodeAt(0) < 32) || name.split('/').some(part => part === '..' || part === '.') || this.entries.has(name)) throw new Error('Unsafe or duplicate ODT ZIP entry.');
      const flags = view.getUint16(offset + 8, true), method = view.getUint16(offset + 10, true);
      const compressed = view.getUint32(offset + 20, true), size = view.getUint32(offset + 24, true), local = view.getUint32(offset + 42, true), crc = view.getUint32(offset + 16, true);
      const madeBy = view.getUint16(offset + 4, true), attributes = view.getUint32(offset + 38, true);
      if ((flags & 1) || (flags & 0x40) || ![0, 8].includes(method) || compressed === 0xffffffff || size === 0xffffffff || local === 0xffffffff || ((madeBy >>> 8) === 3 && ((attributes >>> 16) & 0xf000) === 0xa000)) throw new Error('Unsupported encrypted, linked or ZIP64 ODT entry.');
      declaredTotal += size;
      if (size > this.limits.partBytes || declaredTotal > this.limits.totalBytes) throw new Error('ODT ZIP expanded size quota exceeded.');
      if (local + 30 > centralStart || view.getUint32(local, true) !== 0x04034b50) throw new Error('Invalid ODT ZIP local header.');
      const localNameLength = view.getUint16(local + 26, true), localExtra = view.getUint16(local + 28, true);
      const dataStart = local + 30 + localNameLength + localExtra, dataEnd = dataStart + compressed;
      if (dataEnd > centralStart || view.getUint16(local + 6, true) !== flags || view.getUint16(local + 8, true) !== method || decoder.decode(this.bytes.subarray(local + 30, local + 30 + localNameLength)) !== name) throw new Error('ODT ZIP local/central header mismatch.');
      if (!(flags & 8) && (view.getUint32(local + 14, true) !== crc || view.getUint32(local + 18, true) !== compressed || view.getUint32(local + 22, true) !== size)) throw new Error('ODT ZIP local/central size or checksum mismatch.');
      if (method === 0 && (compressed !== size || compressed > this.limits.partBytes)) throw new Error('ODT ZIP stored size mismatch or quota exceeded.');
      ranges.push([local, dataEnd]); this.entries.set(name, { method, size, compressed, dataStart, crc }); offset = next;
    }
    if (offset !== end) throw new Error('Invalid ODT ZIP directory length.');
    ranges.sort((a, b) => a[0] - b[0]);
    if (ranges.some((range, i) => i > 0 && range[0] < ranges[i - 1]![1])) throw new Error('Overlapping ODT ZIP entries.');
  }
  has(name: string): boolean { return this.entries.has(name); }
  names(): string[] { return [...this.entries.keys()]; }
  async text(name: string): Promise<string> { return new TextDecoder('utf-8', { fatal: true }).decode(await this.data(name)); }
  async data(name: string): Promise<Uint8Array> {
    const cached = this.cache.get(name); if (cached) return cached;
    const entry = this.entries.get(name); if (!entry) throw new Error('ODT package part not found.');
    const payload = this.bytes.subarray(entry.dataStart, entry.dataStart + entry.compressed);
    let bytes: Uint8Array;
    if (entry.method === 0) {
      if (payload.length > this.limits.partBytes || this.expandedBytes + payload.length > this.limits.totalBytes) throw new Error('ODT ZIP actual expanded size quota exceeded.');
      bytes = payload.slice();
    } else {
      if (typeof DecompressionStream === 'undefined') throw new Error('This browser cannot decompress this ODT package.');
      const reader = new Blob([payload.slice().buffer]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
      const chunks: Uint8Array[] = []; let length = 0;
      try {
        while (true) {
          const part = await reader.read(); if (part.done) break;
          length += part.value.length;
          if (length > this.limits.partBytes || length > entry.size || this.expandedBytes + length > this.limits.totalBytes) {
            await reader.cancel(); throw new Error('ODT ZIP actual expanded size quota exceeded.');
          }
          chunks.push(part.value);
        }
      } finally { reader.releaseLock(); }
      bytes = new Uint8Array(length); let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    }
    if (bytes.length !== entry.size || crc32(bytes) !== entry.crc) throw new Error('ODT ZIP expanded size or CRC32 integrity mismatch.');
    this.expandedBytes += bytes.length; this.cache.set(name, bytes); return bytes;
  }
}
