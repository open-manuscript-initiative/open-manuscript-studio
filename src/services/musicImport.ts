import { DOMParser as XmlParser, type Document as XmlDocument, type Element as XmlElement } from '@xmldom/xmldom';
import { createMusicScoreBlock } from '../model/visualBlocks';
import type { OmiMusicScoreBlockData, OmiMusicScoreNote, OmiBlock, OmiImportProvenance } from '../types/omi';

const MAX_NOTES = 20_000;
const XML_SNIFF_BYTES = 4_096;

export async function importMusicFile(file: File, provenance: OmiImportProvenance): Promise<OmiBlock> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  return importMusicBytes(bytes, file.name, provenance);
}

export function importMusicBytes(
  bytes: Uint8Array,
  fileName: string,
  provenance: OmiImportProvenance,
): OmiBlock {
  if (/\.(?:musicxml|xml)$/i.test(fileName) || looksLikeMusicXml(bytes)) {
    const source = new TextDecoder('utf-8').decode(bytes);
    return createMusicBlock(parseMusicXml(source), provenance, 'musicxml', source);
  }

  if (/\.midi?$/i.test(fileName) || readAscii(bytes, 0, 4) === 'MThd') {
    return createMusicBlock(parseMidi(bytes), provenance, 'midi', `data:audio/midi;base64,${bytesToBase64(bytes)}`);
  }

  throw new Error(`Unsupported music import format: ${fileName}`);
}

function looksLikeMusicXml(bytes: Uint8Array): boolean {
  if (bytes.length === 0) return false;
  const prefix = new TextDecoder('utf-8')
    .decode(bytes.subarray(0, Math.min(bytes.length, XML_SNIFF_BYTES)))
    .replace(/^\uFEFF/, '')
    .trimStart();
  return /^(?:<\?xml\b[^>]*>\s*)?(?:<!DOCTYPE\s+score-partwise\b[^>]*>\s*)?<score-partwise\b/i.test(prefix);
}

function createMusicBlock(
  parsed: Omit<OmiMusicScoreBlockData, 'kind' | 'format' | 'source' | 'provenance'>,
  provenance: OmiImportProvenance,
  format: 'musicxml' | 'midi',
  source: string,
): OmiBlock {
  return createMusicScoreBlock({ format, source, provenance, ...parsed });
}

function parseMusicXml(source: string): Omit<OmiMusicScoreBlockData, 'kind' | 'format' | 'source' | 'provenance'> {
  // Use an isolated XML tree, never the browser DOM or an HTML parsing sink.
  // External DTD identifiers in ordinary MusicXML are retained but never fetched.
  if (/<!ENTITY\b/i.test(source)) throw new Error('MusicXML entity declarations are not supported.');
  const xml = new XmlParser({ onError: () => { throw new Error('Invalid MusicXML.'); } }).parseFromString(source, 'application/xml');
  if (xml.documentElement?.localName !== 'score-partwise') throw new Error('Expected a score-partwise MusicXML document.');
  const title = text(xml, 'work-title') || text(xml, 'movement-title') || undefined;
  const composer = findElements(xml, 'creator').map((node) => node.textContent?.trim()).find(Boolean);
  const attributes = findElements(xml, 'measure attributes')[0] ?? null;
  const divisions = number(attributes, 'divisions') || 1;
  const beats = number(attributes, 'time beats');
  const beatType = number(attributes, 'time beat-type');
  const notes: OmiMusicScoreNote[] = findElements(xml, 'part measure note').map((note) => ({
    step: text(note, 'pitch step') || 'C',
    octave: number(note, 'pitch octave') || 4,
    alter: number(note, 'pitch alter') || undefined,
    duration: number(note, 'duration') || undefined,
    type: text(note, 'type') || undefined,
    rest: findElements(note, 'rest').length > 0,
  })).slice(0, MAX_NOTES);
  if (notes.length === 0) throw new Error('The MusicXML file contains no notes.');
  return { title, composer, divisions, beats, beatType, notes };
}

function parseMidi(bytes: Uint8Array): Omit<OmiMusicScoreBlockData, 'kind' | 'format' | 'source' | 'provenance'> {
  if (readAscii(bytes, 0, 4) !== 'MThd') throw new Error('The MIDI file has no valid header.');
  const tracks = readU16(bytes, 10);
  const notes: OmiMusicScoreNote[] = [];
  let offset = 14;
  for (let track = 0; track < tracks && offset + 8 <= bytes.length && notes.length < MAX_NOTES; track += 1) {
    if (readAscii(bytes, offset, 4) !== 'MTrk') break;
    const length = readU32(bytes, offset + 4);
    const end = Math.min(bytes.length, offset + 8 + length);
    offset += 8;
    let running = 0;
    while (offset < end && notes.length < MAX_NOTES) {
      offset = skipVlq(bytes, offset, end);
      if (offset >= end) break;
      let status = bytes[offset++] ?? 0;
      if (status < 0x80) { status = running; offset -= 1; } else running = status;
      if (status === 0xff) { const type = bytes[offset++] ?? 0; const result = readVlq(bytes, offset, end); offset = result.offset + result.value; if (type === 0x2f) break; continue; }
      if (status === 0xf0 || status === 0xf7) { const result = readVlq(bytes, offset, end); offset = result.offset + result.value; continue; }
      const command = status & 0xf0;
      const pitch = bytes[offset++] ?? 0;
      const velocity = bytes[offset++] ?? 0;
      if ((command === 0x90 && velocity > 0) || command === 0x80) notes.push(midiPitch(pitch));
    }
    offset = end;
  }
  if (notes.length === 0) throw new Error('The MIDI file contains no note events.');
  return { title: undefined, composer: undefined, notes };
}

function midiPitch(value: number): OmiMusicScoreNote {
  const names = ['C', 'C', 'D', 'D', 'E', 'F', 'F', 'G', 'G', 'A', 'A', 'B'];
  const alters = [0, 1, 0, 1, 0, 0, 1, 0, 1, 0, 1, 0];
  const index = value % 12;
  return { step: names[index] ?? 'C', octave: Math.floor(value / 12) - 1, alter: alters[index] || undefined };
}

function findElements(root: XmlDocument | XmlElement, path: string): XmlElement[] {
  let roots: Array<XmlDocument | XmlElement> = [root];
  for (const name of path.split(' ')) {
    roots = roots.flatMap((node) => Array.from(node.getElementsByTagNameNS('*', name)));
  }
  return roots as XmlElement[];
}
function text(root: XmlDocument | XmlElement, selector: string): string {
  // Keep scholarly text intact; React and exporters escape at the output boundary.
  return findElements(root, selector)[0]?.textContent?.trim() ?? '';
}
function number(root: XmlDocument | XmlElement | null, selector: string): number | undefined { const value = root ? Number(text(root, selector)) : NaN; return Number.isFinite(value) && value > 0 ? value : undefined; }
function readAscii(bytes: Uint8Array, offset: number, length: number): string { return String.fromCharCode(...bytes.subarray(offset, offset + length)); }
function readU16(bytes: Uint8Array, offset: number): number { return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0); }
function readU32(bytes: Uint8Array, offset: number): number { return ((bytes[offset] ?? 0) * 0x1000000) + ((bytes[offset + 1] ?? 0) << 16) + ((bytes[offset + 2] ?? 0) << 8) + (bytes[offset + 3] ?? 0); }
function readVlq(bytes: Uint8Array, offset: number, end: number): { value: number; offset: number } { let value = 0; while (offset < end) { const byte = bytes[offset++] ?? 0; value = (value << 7) | (byte & 0x7f); if (!(byte & 0x80)) break; } return { value, offset }; }
function skipVlq(bytes: Uint8Array, offset: number, end: number): number { return readVlq(bytes, offset, end).offset; }
function bytesToBase64(bytes: Uint8Array): string { let binary = ''; for (let index = 0; index < bytes.length; index += 8192) binary += String.fromCharCode(...bytes.subarray(index, index + 8192)); return btoa(binary); }
