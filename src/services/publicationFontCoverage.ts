import type { OmiBlock, OmiManuscript, OmiSection } from '../types/omi';
import { extractOmiInlineRuns } from '../model/inlineSemantics';
import { isNoteAnnotation } from '../model/notes';
import type { PublicationLayoutIssue } from '../model/publicationLayoutDiagnostics';

type Location = Pick<PublicationLayoutIssue, 'sectionId' | 'blockId'>;
export interface CharacterOccurrence extends Location { codePoint: number; character: string }
export interface FontCoverageResult {
  status: 'complete' | 'partial' | 'unavailable';
  missing: CharacterOccurrence[];
  checked: number;
  unreadable: number;
  total: number;
}
interface LocalFace { blob(): Promise<Blob> }
type FontWindow = Window & { queryLocalFonts?: () => Promise<LocalFace[]> };

export function collectPublicationCharacters(manuscript: OmiManuscript): CharacterOccurrence[] {
  const result: CharacterOccurrence[] = [];
  const seen = new Set<string>();
  const add = (text: string | undefined, location: Location) => {
    for (const character of text ?? '') {
      // Formatting controls and variation selectors need shaping, not standalone glyphs.
      if (/[\p{White_Space}\p{Cc}\p{Cf}]/u.test(character) || /[\uFE00-\uFE0F\u{E0100}-\u{E01EF}]/u.test(character)) continue;
      const codePoint = character.codePointAt(0)!;
      const key = JSON.stringify([location.blockId, location.sectionId, codePoint]);
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({ ...location, codePoint, character });
    }
  };
  const rich = (content: string, loc: Location) => {
    for (const run of extractOmiInlineRuns(content)) add(run.text, loc);
  };
  const block = (b: OmiBlock, sectionId: string) => {
    const loc = { blockId: b.id, sectionId };
    if (!b.visual) rich(b.content, loc);
    if (b.visual?.kind === 'table') {
      add(b.visual.caption, loc);
      for (const row of b.visual.cells) for (const cell of row) add(cell, loc);
    }
    for (const child of b.children ?? []) block(child, sectionId);
  };
  const section = (s: OmiSection) => {
    add(s.title, { sectionId: s.id });
    for (const b of s.blocks) block(b, s.id);
    for (const child of s.children ?? []) section(child);
  };
  add(manuscript.title, {});
  add(manuscript.subtitle, {});
  add(manuscript.abstract, {});
  add(manuscript.motto, {});
  for (const keyword of manuscript.keywords ?? []) add(keyword, {});
  for (const s of manuscript.sections) section(s);
  for (const note of manuscript.annotations ?? []) {
    if (!isNoteAnnotation(note)) continue;
    const loc = { blockId: note.targetBlockId };
    if (note.bodyContent) rich(note.bodyContent, loc);
    else add(note.body, loc);
  }
  return result;
}

/** Parse Unicode cmap mappings in SFNT (TrueType/OpenType), including TTC.
 * A mapping to glyph zero is explicitly not coverage. Unsupported/malformed
 * font data throws so callers never label an incomplete inventory definitive.
 */
export function mappedCodePoints(buffer: ArrayBuffer, wanted: ReadonlySet<number>): Set<number> {
  const d = new DataView(buffer);
  const out = new Set<number>();
  const u16 = (p: number) => d.getUint16(p);
  const u32 = (p: number) => d.getUint32(p);
  const bounds = (p: number, n: number, end = d.byteLength) => {
    if (p < 0 || n < 0 || p + n > end) throw new Error('Invalid font table');
  };
  const tag = (p: number) => u32(p);
  const sfnts: number[] = [];
  if (tag(0) === 0x74746366) {
    const n = u32(8);
    if (!n || n > 256) throw new Error('Unsupported font collection');
    bounds(12, n * 4);
    for (let i = 0; i < n; i++) sfnts.push(u32(12 + i * 4));
  } else sfnts.push(0);
  for (const base of sfnts) {
    const signature = tag(base);
    if (![0x00010000, 0x4f54544f, 0x74727565].includes(signature)) throw new Error('Unsupported font format');
    const count = u16(base + 4);
    bounds(base + 12, count * 16);
    let cmap = -1, end = 0;
    for (let i = 0; i < count; i++) {
      const p = base + 12 + i * 16;
      if (tag(p) !== 0x636d6170) continue;
      cmap = u32(p + 8); const length = u32(p + 12);
      bounds(cmap, length); end = cmap + length; break;
    }
    if (cmap < 0) throw new Error('Missing cmap');
    bounds(cmap, 4, end);
    const n = u16(cmap + 2);
    bounds(cmap + 4, n * 8, end);
    let supported = false;
    const visited = new Set<number>();
    for (let i = 0; i < n; i++) {
      const p = cmap + 4 + i * 8, platform = u16(p), encoding = u16(p + 2);
      if (platform !== 0 && !(platform === 3 && (encoding === 1 || encoding === 10))) continue;
      const sub = cmap + u32(p + 4);
      bounds(sub, 2, end);
      if (visited.has(sub)) continue;
      visited.add(sub);
      const format = u16(sub);
      if (format === 14) continue; // variation sequences are not checked here
      if (format !== 4 && format !== 12 && format !== 13 && format !== 0 && format !== 6 && format !== 10) continue;
      supported = true;
      const wide = format >= 10;
      bounds(sub, wide ? 8 : 4, end);
      const length = wide ? u32(sub + 4) : u16(sub + 2);
      bounds(sub, length, end);
      const limit = sub + length;
      let has: (cp: number) => boolean;
      if (format === 4) {
        bounds(sub, 16, limit);
        const segments = u16(sub + 6) / 2;
        if (!Number.isInteger(segments) || !segments) throw new Error('Invalid cmap4');
        const ends = sub + 14, starts = ends + segments * 2 + 2;
        const deltas = starts + segments * 2, offsets = deltas + segments * 2;
        bounds(offsets, segments * 2, limit);
        has = cp => {
          if (cp > 0xffff) return false;
          let l = 0, h = segments;
          while (l < h) { const m = (l + h) >>> 1; if (u16(ends + m * 2) < cp) l = m + 1; else h = m; }
          if (l === segments || cp < u16(starts + l * 2)) return false;
          const delta = u16(deltas + l * 2), ptr = offsets + l * 2, offset = u16(ptr);
          if (!offset) return ((cp + delta) & 0xffff) !== 0;
          const glyphPtr = ptr + offset + (cp - u16(starts + l * 2)) * 2;
          bounds(glyphPtr, 2, limit);
          const glyph = u16(glyphPtr);
          return glyph !== 0 && ((glyph + delta) & 0xffff) !== 0;
        };
      } else if (format === 12 || format === 13) {
        bounds(sub, 16, limit);
        const groups = u32(sub + 12), first = sub + 16;
        bounds(first, groups * 12, limit);
        has = cp => {
          let l = 0, h = groups;
          while (l < h) { const m = (l + h) >>> 1; if (u32(first + m * 12 + 4) < cp) l = m + 1; else h = m; }
          if (l === groups) return false;
          const p = first + l * 12, start = u32(p);
          return cp >= start && (format === 13 ? u32(p + 8) : u32(p + 8) + cp - start) !== 0;
        };
      } else {
        const header = format === 0 ? 6 : format === 6 ? 10 : 20;
        bounds(sub, header, limit);
        const start = format === 0 ? 0 : format === 6 ? u16(sub + 6) : u32(sub + 12);
        const count = format === 0 ? 256 : format === 6 ? u16(sub + 8) : u32(sub + 16);
        const width = format === 0 ? 1 : 2;
        bounds(sub + header, count * width, limit);
        has = cp => cp >= start && cp - start < count && (width === 1 ? d.getUint8(sub + header + cp - start) : u16(sub + header + (cp - start) * 2)) !== 0;
      }
      for (const cp of wanted) if (!out.has(cp) && has(cp)) out.add(cp);
    }
    if (!supported) throw new Error('No supported Unicode cmap');
  }
  return out;
}

export async function checkLocalPublicationFontCoverage(occurrences: readonly CharacterOccurrence[], signal?: AbortSignal): Promise<FontCoverageResult> {
  const remaining = new Set(occurrences.map(o => o.codePoint));
  const unavailable: FontCoverageResult = { status: 'unavailable', missing: [], checked: 0, unreadable: 0, total: remaining.size };
  if (!remaining.size) return { ...unavailable, status: 'complete' };
  const query = typeof window !== 'undefined' ? (window as FontWindow).queryLocalFonts : undefined;
  if (!query) return unavailable;
  let faces: LocalFace[];
  try { faces = await query.call(window); } catch { return unavailable; }
  if (!faces.length) return unavailable;
  let unreadable = 0, checked = 0;
  for (const face of faces) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    if (!remaining.size) break;
    try {
      const blob = await face.blob();
      if (blob.size > 64 * 1024 * 1024) throw new Error('Font exceeds scan budget');
      for (const cp of mappedCodePoints(await blob.arrayBuffer(), remaining)) remaining.delete(cp);
      checked++;
    } catch { unreadable++; }
    // Allow the editor to remain responsive while a large inventory is read.
    await new Promise<void>(resolve => setTimeout(resolve, 0));
  }
  return {
    status: remaining.size && unreadable ? 'partial' : 'complete',
    missing: occurrences.filter(o => remaining.has(o.codePoint)),
    checked, unreadable, total: unavailable.total,
  };
}
