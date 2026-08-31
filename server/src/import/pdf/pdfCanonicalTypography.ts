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
  for (const line of lines) canonicalizeLine(line);
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
    const displayText = rawText.normalize('NFC');
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

  markSoftInlineReferenceCandidates(line, typicalHeight);
}

/**
 * Poppler sometimes flattens a printed superscript marker into a normal-sized
 * standalone numeric word. Keep superscript geometry as the primary signal,
 * but expose these flattened inline numbers to the existing attached-marker
 * matcher without changing their visible text or their `script` classification.
 *
 * We encode the soft candidate on the preceding word's canonical value only.
 * The semantic matcher later still requires a same-page note start with the
 * same marker before accepting it. Numbered list starts such as `6. Travel...`
 * are intentionally excluded because the marker word must contain digits only
 * and must have a lexical word immediately before it on the same line.
 */
function markSoftInlineReferenceCandidates<TLine extends CanonicalPdfLine>(line: TLine, typicalHeight: number): void {
  for (let index = 1; index < line.words.length - 1; index += 1) {
    const word = line.words[index]!;
    if (word.script !== 'normal') continue;

    const marker = parseCanonicalNoteMarker(word.canonicalText ?? word.text);
    if (!marker) continue;

    const previous = line.words[index - 1]!;
    const next = line.words[index + 1]!;
    const previousText = previous.rawText ?? previous.text;
    const nextCanonical = (next.canonicalText ?? next.text).trim();

    if (!/[\p{L}\p{M}\p{P}]$/u.test(previousText)) continue;
    if (!/^[\p{L}\p{M}"“„'‘(\[]/u.test(nextCanonical)) continue;

    const horizontalGap = Math.max(0, word.xMin - previous.xMax);
    if (horizontalGap > Math.max(9, typicalHeight * 0.9)) continue;

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
