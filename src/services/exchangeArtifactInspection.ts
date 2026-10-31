import type { ExchangeFormat } from '../model/exchange';
import { parseOmiJson } from './omiPortableFormat';

/**
 * Fast fail-closed envelope preflight for OMI-SPEC-340's Studio mapping profile.
 *
 * This is NOT a substitute for DOCX/ODT/EPUB package validation, JATS DTD
 * validation, PDF conformance, accessibility checks or semantic round trips.
 * No successful preflight can assert that conversion is lossless.
 */
export function hasExpectedExchangeArtifactEnvelope(format: ExchangeFormat, bytes: Uint8Array): boolean {
  if (bytes.byteLength === 0) return false;

  if (['omi', 'docx', 'odt', 'idml', 'html', 'epub'].includes(format)) {
    // The Studio "html" exchange option emits a ZIP HTML5 package rather than
    // the standalone HTML article used by the publishing transfer API.
    return hasZipDirectoryEnvelope(bytes);
  }

  if (format === 'omi-json') {
    try {
      parseOmiJson(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      return true;
    } catch {
      return false;
    }
  }

  if (format === 'pdf') {
    const magic = new TextDecoder().decode(bytes.subarray(0, 5));
    return magic === '%PDF-';
  }

  if (format === 'jats') {
    // Detailed DTD and semantic validation are separate mandatory release
    // gates. Here, reject plainly unrelated text and non-article XML.
    const head = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, 8192));
    return /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!DOCTYPE\s+article\b[^>]*>\s*)?<article(?:\s|>)/i.test(head);
  }

  return true; // Other adapters lack a published envelope validator.
}

/** Reject truncated and fake-PK ZIP files, without attempting extraction. */
function hasZipDirectoryEnvelope(bytes: Uint8Array): boolean {
  if (bytes.length < 22 || readU32(bytes, 0) !== 0x04034b50) return false;
  // ZIP comments can be up to 65535 bytes; EOCD is at least 22 bytes.
  const start = Math.max(0, bytes.length - 22 - 0xffff);
  for (let offset = bytes.length - 22; offset >= start; offset -= 1) {
    if (readU32(bytes, offset) !== 0x06054b50) continue;
    const commentLength = readU16(bytes, offset + 20);
    if (commentLength === undefined || offset + 22 + commentLength !== bytes.length) continue;
    const disk = readU16(bytes, offset + 4);
    const centralDisk = readU16(bytes, offset + 6);
    const onDisk = readU16(bytes, offset + 8);
    const total = readU16(bytes, offset + 10);
    const centralSize = readU32(bytes, offset + 12);
    const centralOffset = readU32(bytes, offset + 16);
    if (disk !== 0 || centralDisk !== 0 || onDisk === undefined || !total ||
      onDisk !== total || centralSize === undefined || centralSize < 46 ||
      centralOffset === undefined || centralOffset < 30 ||
      centralOffset + centralSize !== offset) continue;
    if (readU32(bytes, centralOffset) !== 0x02014b50) continue;
    // Verify the first central directory record points to an actual local
    // file record rather than trusting PK bytes at arbitrary offsets.
    if (centralOffset + 46 > offset) continue;
    const localOffset = readU32(bytes, centralOffset + 42);
    if (localOffset === undefined || localOffset >= centralOffset ||
      readU32(bytes, localOffset) !== 0x04034b50) continue;
    return true;
  }
  return false;
}

function readU16(bytes: Uint8Array, offset: number): number | undefined {
  return offset >= 0 && offset + 2 <= bytes.length
    ? bytes[offset]! | (bytes[offset + 1]! << 8) : undefined;
}

function readU32(bytes: Uint8Array, offset: number): number | undefined {
  if (offset < 0 || offset + 4 > bytes.length) return undefined;
  return ((bytes[offset]! | (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0);
}
