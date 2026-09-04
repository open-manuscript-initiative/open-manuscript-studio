import { normalizePdfDiscretionaryBreaks } from './pdfDiscretionaryBreaks.js';
import { mergeStackedFootnoteMarkerRows } from './pdfFootnoteGeometry.js';
import { findSequentialFootnoteStartRun } from './pdfFootnoteSequence.js';
import { findStructuralFootnoteStarts } from './pdfStructuralFootnotes.js';

export type PdfScriptPosition = 'normal' | 'superscript' | 'subscript';

export interface CanonicalPdfWord {
  text: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
  rawText?: string;
  canonicalText?: string;
  script?: PdfScriptPosition;
  fontHeight?: number;
  baselineOffset?: number;
  superscriptMarker?: string;
}

export interface CanonicalPdfLine<TWord extends CanonicalPdfWord = CanonicalPdfWord> {
  words: TWord[];
  text?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '⁰': '0',
  '¹': '1',
  '²': '2',
  '³': '3',
  '⁴': '4',
  '⁵': '5',
  '⁶': '6',
  '⁷': '7',
  '⁸': '8',
  '⁹': '9',
};

const SUBSCRIPT_DIGITS: Record<string, string> = {
  '₀': '0',
  '₁': '1',
  '₂': '2',
  '₃': '3',
  '₄': '4',
  '₅': '5',
  '₆': '6',
  '₇': '7',
  '₈': '8',
  '₉': '9',
};

/**
 * Build a page-local canonical typography representation before any semantic
 * PDF reconstruction. `rawText` preserves the extractor output, `text` is NFC
 * for stable display, and `canonicalText` is NFKC for semantic matching.
 * Script position remains a separate property so normalization never destroys
 * evidence that a marker was printed as superscript/subscript.
 */
export function canonicalizePdfPageTypography<TLine extends CanonicalPdfLine>(lines: TLine[]): TLine[] {
  mergeStackedFootnoteMarkerRows(lines);
  mergeSplitFootnoteStartLines(lines);
  for (const line of lines) canonicalizeLine(line);
  recoverAnchorsFromSequentialNoteStarts(lines);
  return lines;
}

export function canonicalizePdfText(value: string): string {
  return value.normalize('NFKC');
}

export function normalizeSuperscriptDigits(value: string): string {
  return [...value].map((character) => SUPERSCRIPT_DIGITS[character] ?? character).join('');
}

export function normalizeSubscriptDigits(value: string): string {
  return [...value].map((character) => SUBSCRIPT_DIGITS[character] ?? character).join('');
}

export function parseCanonicalNoteMarker(value: string): string | null {
  const canonical = canonicalizePdfText(value).trim();
  return /^[1-9][0-9]{0,2}$/u.test(canonical) ? canonical : null;
}

/**
 * Poppler's bbox-layout output frequently places a footnote number in its own
 * flow/line while the corresponding note text is emitted as a separate line
 * at the same vertical position. Recombine that purely presentational split
 * before semantic note detection.
 *
 * A split marker is accepted only when it is a single numeric word, is clearly
 * smaller than the text line beside it, overlaps that line vertically, and
 * sits immediately to its left. Normal numbered paragraphs therefore remain
 * untouched because their number normally has the same font height as the
 * following text.
 */
function mergeSplitFootnoteStartLines<TLine extends CanonicalPdfLine>(lines: TLine[]): void {
  const removeIndexes = new Set<number>();

  for (let markerIndex = 0; markerIndex < lines.length; markerIndex += 1) {
    const markerLine = lines[markerIndex]!;
    if (markerLine.words.length !== 1) continue;

    const markerWord = markerLine.words[0]!;
    const marker = parseCanonicalNoteMarker(markerWord.text);
    if (!marker) continue;

    const markerHeight = Math.max(1, markerWord.yMax - markerWord.yMin);
    const markerCenter = (markerWord.yMin + markerWord.yMax) / 2;

    let bestTargetIndex = -1;
    let bestScore = Number.POSITIVE_INFINITY;

    for (let targetIndex = 0; targetIndex < lines.length; targetIndex += 1) {
      if (targetIndex === markerIndex || removeIndexes.has(targetIndex)) continue;
      const targetLine = lines[targetIndex]!;
      if (!targetLine.words.length) continue;

      const firstWord = targetLine.words[0]!;
      const targetHeight = median(targetLine.words.map((word) => Math.max(1, word.yMax - word.yMin)))
        ?? Math.max(1, firstWord.yMax - firstWord.yMin);
      if (markerHeight > targetHeight * 0.78) continue;

      const targetCenter = (firstWord.yMin + firstWord.yMax) / 2;
      const centerDistance = Math.abs(markerCenter - targetCenter);
      if (centerDistance > Math.max(3.2, targetHeight * 0.3)) continue;

      const verticalOverlap = Math.min(markerWord.yMax, firstWord.yMax) - Math.max(markerWord.yMin, firstWord.yMin);
      if (verticalOverlap < markerHeight * 0.45) continue;

      const horizontalGap = firstWord.xMin - markerWord.xMax;
      if (horizontalGap < 0 || horizontalGap > Math.max(18, targetHeight * 1.7)) continue;

      const firstText = canonicalizePdfText(firstWord.text).trim();
      if (!/^[\p{L}\p{M}"“„'‘([]/u.test(firstText)) continue;

      const score = centerDistance + horizontalGap * 0.05;
      if (score < bestScore) {
        bestScore = score;
        bestTargetIndex = targetIndex;
      }
    }

    if (bestTargetIndex < 0) continue;
    const targetLine = lines[bestTargetIndex]!;
    targetLine.words.unshift(markerWord);
    targetLine.text = targetLine.words.map((word) => word.text).join(' ').replace(/\s+/gu, ' ').trim();
    if (typeof targetLine.xMin === 'number') targetLine.xMin = Math.min(targetLine.xMin, markerWord.xMin);
    if (typeof targetLine.yMin === 'number') targetLine.yMin = Math.min(targetLine.yMin, markerWord.yMin);
    if (typeof targetLine.yMax === 'number') targetLine.yMax = Math.max(targetLine.yMax, markerWord.yMax);
    removeIndexes.add(markerIndex);
  }

  if (!removeIndexes.size) return;
  for (const index of [...removeIndexes].sort((left, right) => right - left)) {
    lines.splice(index, 1);
  }
}

function canonicalizeLine<TLine extends CanonicalPdfLine>(line: TLine): void {
  if (!line.words.length) return;

  const heights = line.words.map((word) => Math.max(1, word.yMax - word.yMin));
  const typicalHeight = median(heights) ?? 1;
  const explicitScriptWords = new Set(
    line.words.filter((word) => hasExplicitScriptGlyph(word.text)),
  );
  const baselineCandidates = line.words
    .filter((word) => !explicitScriptWords.has(word))
    .map((word) => word.yMax);
  const baseline = median(baselineCandidates) ?? median(line.words.map((word) => word.yMax)) ?? 0;

  for (const word of line.words) {
    const rawText = word.text;
    const displayText = normalizePdfDiscretionaryBreaks(rawText).normalize('NFC');
    const canonicalText = canonicalizePdfText(displayText);
    const fontHeight = Math.max(1, word.yMax - word.yMin);
    const baselineOffset = baseline - word.yMax;
    const explicitSuperscript = extractSuperscriptMarker(rawText);
    const explicitSubscript = /^[₀₁₂₃₄₅₆₇₈₉]+$/u.test(rawText);

    const raised = baselineOffset >= Math.max(0.28, typicalHeight * 0.028);
    const lowered = -baselineOffset >= Math.max(0.42, typicalHeight * 0.045);
    const reduced = fontHeight <= typicalHeight * 0.95;

    let script: PdfScriptPosition = 'normal';
    if (explicitSuperscript || (raised && reduced)) script = 'superscript';
    else if (explicitSubscript || (lowered && reduced)) script = 'subscript';

    word.rawText = rawText;
    word.text = displayText;
    word.canonicalText = canonicalText;
    word.script = script;
    word.fontHeight = fontHeight;
    word.baselineOffset = baselineOffset;
    if (explicitSuperscript) word.superscriptMarker = explicitSuperscript;
  }

  line.text = line.words.map((word) => word.text).join(' ').replace(/\s+/gu, ' ').trim();
  markSoftInlineReferenceCandidates(line, typicalHeight);
}

/**
 * Use numbered footnote paragraphs themselves as structural evidence. A strong
 * sequential run may establish footnotes even when Poppler loses one or more
 * body superscripts. Real body references are still preferred; a synthetic
 * preceding-line marker is used only as a transport signal for the downstream
 * page-local matcher when the structural run is already independently proven.
 */
function recoverAnchorsFromSequentialNoteStarts<TLine extends CanonicalPdfLine>(lines: TLine[]): void {
  if (lines.length < 3) return;

  const ordered = lines
    .map((line, sourceIndex) => ({ line, sourceIndex }))
    .sort((left, right) => (left.line.yMin ?? 0) - (right.line.yMin ?? 0)
      || (left.line.xMin ?? 0) - (right.line.xMin ?? 0));
  const pageHeight = Math.max(...ordered.map(({ line }) => line.yMax ?? 0), 1);
  const allWordHeights = ordered.flatMap(({ line }) => line.words
    .map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin)));
  const medianWordHeight = median(allWordHeights) ?? 1;

  const startCandidates = ordered.flatMap(({ line }, lineIndex) => {
    if (line.words.length < 2) return [];
    const first = line.words[0]!;
    const marker = parseCanonicalNoteMarker((first.canonicalText ?? first.text).replace(/[.)]+$/u, ''));
    if (!marker) return [];
    const secondText = (line.words[1]?.canonicalText ?? line.words[1]?.text ?? '').trim();
    if (!/^[\p{L}\p{M}\p{N}"“„'‘([]/u.test(secondText)) return [];
    return [{
      marker,
      lineIndex,
      markerOffset: 0,
      fontHeight: median(line.words.map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin))) ?? medianWordHeight,
      xMin: first.xMin,
      yMin: line.yMin ?? first.yMin,
      pageHeight,
    }];
  });

  const run = findSequentialFootnoteStartRun(startCandidates, null, medianWordHeight);
  if (!run) return;
  const structuralMarkers = new Set(findStructuralFootnoteStarts(lines).map((item) => item.marker));

  for (const marker of run.markers) {
    const starts = startCandidates
      .filter((candidate) => candidate.marker === marker && run.candidateIndexes.has(startCandidates.indexOf(candidate)))
      .sort((left, right) => left.lineIndex - right.lineIndex);
    const start = starts[0];
    if (!start) continue;

    const noteLine = ordered[start.lineIndex]?.line;
    if (!noteLine) continue;
    const noteHeight = median(noteLine.words.map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin)))
      ?? medianWordHeight;

    let best: { lineIndex: number; wordIndex: number; score: number } | null = null;
    for (let lineIndex = 0; lineIndex < start.lineIndex; lineIndex += 1) {
      const line = ordered[lineIndex]?.line;
      if (!line?.words.length) continue;
      const lineHeight = median(line.words.map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin)))
        ?? medianWordHeight;

      for (let wordIndex = 0; wordIndex < line.words.length; wordIndex += 1) {
        const word = line.words[wordIndex]!;
        const value = parseCanonicalNoteMarker((word.canonicalText ?? word.text).replace(/[.)]+$/u, ''));
        if (value !== marker) continue;

        const previous = line.words[wordIndex - 1];
        if (!previous || !/[\p{L}\p{M}\p{P}]$/u.test(previous.rawText ?? previous.text)) continue;

        const gap = Math.max(0, word.xMin - previous.xMax);
        const scriptBonus = word.script === 'superscript' || word.superscriptMarker === marker ? 12 : 0;
        const bodySizeBonus = lineHeight >= noteHeight * 1.08 ? 7 : 0;
        const proximityBonus = gap <= Math.max(16, lineHeight * 1.5) ? 6 : 0;
        const laterBodyBonus = lineIndex / Math.max(1, start.lineIndex);
        const score = scriptBonus + bodySizeBonus + proximityBonus + laterBodyBonus;
        if (!best || score > best.score) best = { lineIndex, wordIndex, score };
      }
    }

    if (!best) {
      if (!structuralMarkers.has(marker)) continue;
      const fallback = findSyntheticStructuralAnchor(ordered, start.lineIndex);
      if (!fallback) continue;
      ordered[fallback.lineIndex]!.line.words[fallback.wordIndex]!.superscriptMarker = marker;
      continue;
    }

    const bodyLine = ordered[best.lineIndex]!.line;
    const markerWord = bodyLine.words[best.wordIndex]!;
    const previous = bodyLine.words[best.wordIndex - 1]!;
    const previousCanonical = previous.canonicalText ?? canonicalizePdfText(previous.text);
    if (!new RegExp(`${marker}$`, 'u').test(previousCanonical)) {
      previous.canonicalText = `${previousCanonical}${marker}`;
    }
    markerWord.superscriptMarker = marker;
  }
}

function findSyntheticStructuralAnchor<TLine extends CanonicalPdfLine>(
  ordered: readonly { line: TLine; sourceIndex: number }[],
  startLineIndex: number,
): { lineIndex: number; wordIndex: number } | null {
  for (let lineIndex = startLineIndex - 1; lineIndex >= 0; lineIndex -= 1) {
    const line = ordered[lineIndex]?.line;
    if (!line?.words.length) continue;
    for (let wordIndex = line.words.length - 1; wordIndex >= 0; wordIndex -= 1) {
      const word = line.words[wordIndex]!;
      if (!/[\p{L}\p{M}\p{P}]$/u.test(word.rawText ?? word.text)) continue;
      return { lineIndex, wordIndex };
    }
  }
  return null;
}

/**
 * Poppler sometimes flattens a printed superscript marker into a normal-sized
 * standalone numeric word. Keep superscript geometry as the primary signal,
 * but expose these flattened inline numbers to the existing attached-marker
 * matcher without changing their visible text or their `script` classification.
 *
 * We encode the soft candidate on the preceding word's canonical value only.
 * The semantic matcher later still requires a same-page note start with the
 * same marker before accepting it. This lets us recover markers at the end of
 * a Poppler line as well as markers followed by more text. Numbered list starts
 * such as `6. Travel...` remain excluded because the marker must have a lexical
 * word immediately before it on the same line.
 */
function markSoftInlineReferenceCandidates<TLine extends CanonicalPdfLine>(line: TLine, typicalHeight: number): void {
  for (let index = 1; index < line.words.length; index += 1) {
    const word = line.words[index]!;
    if (word.script !== 'normal') continue;

    const marker = parseCanonicalNoteMarker(word.canonicalText ?? word.text);
    if (!marker) continue;

    const previous = line.words[index - 1]!;
    const next = line.words[index + 1];
    const previousText = previous.rawText ?? previous.text;

    if (!/[\p{L}\p{M}\p{P}]$/u.test(previousText)) continue;
    if (next) {
      const nextCanonical = (next.canonicalText ?? next.text).trim();
      if (!/^[\p{L}\p{M}"“„'‘([]/u.test(nextCanonical)) continue;
    }

    const horizontalGap = Math.max(0, word.xMin - previous.xMax);
    if (horizontalGap > Math.max(14, typicalHeight * 1.35)) continue;

    const previousCanonical = previous.canonicalText ?? canonicalizePdfText(previous.text);
    if (new RegExp(`${marker}$`, 'u').test(previousCanonical)) continue;
    previous.canonicalText = `${previousCanonical}${marker}`;
  }
}

function extractSuperscriptMarker(value: string): string | undefined {
  const standalone = value.match(/^([⁰¹²³⁴⁵⁶⁷⁸⁹]+)$/u)?.[1];
  const suffix = standalone ?? value.match(/([⁰¹²³⁴⁵⁶⁷⁸⁹]{1,3})$/u)?.[1];
  if (!suffix) return undefined;
  const normalized = normalizeSuperscriptDigits(suffix);
  return /^[1-9][0-9]{0,2}$/u.test(normalized) ? normalized : undefined;
}

function hasExplicitScriptGlyph(value: string): boolean {
  return /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉]/u.test(value);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}
