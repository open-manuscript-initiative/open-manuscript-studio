import { findSequentialFootnoteStartRun } from './pdfFootnoteSequence.js';
import type { CanonicalPdfLine } from './pdfCanonicalTypography.js';

export interface StructuralFootnoteStart {
  marker: string;
  lineIndex: number;
}

/**
 * Treat a strong sequential series of numbered note starts as structural
 * footnote evidence even when the corresponding body superscript was lost by
 * PDF extraction. This is intentionally page-local and conservative: the run
 * must already satisfy the shared sequence detector and occupy the compact,
 * lower-page typography typical of scholarly footnotes.
 */
export function findStructuralFootnoteStarts<TLine extends CanonicalPdfLine>(
  lines: readonly TLine[],
): StructuralFootnoteStart[] {
  if (lines.length < 3) return [];

  const ordered = lines
    .map((line, sourceIndex) => ({ line, sourceIndex }))
    .sort((left, right) => (left.line.yMin ?? 0) - (right.line.yMin ?? 0)
      || (left.line.xMin ?? 0) - (right.line.xMin ?? 0));
  const pageHeight = Math.max(...ordered.map(({ line }) => line.yMax ?? 0), 1);
  const allHeights = ordered.flatMap(({ line }) => line.words
    .map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin)));
  const medianWordHeight = median(allHeights) ?? 1;

  const candidates = ordered.flatMap(({ line }, lineIndex) => {
    if (line.words.length < 2) return [];
    const first = line.words[0]!;
    const marker = normalizeMarker(first.canonicalText ?? first.text);
    if (!marker) return [];
    const second = (line.words[1]?.canonicalText ?? line.words[1]?.text ?? '').trim();
    if (!/^[\p{L}\p{M}\p{N}"“„'‘(\[]/u.test(second)) return [];
    const fontHeight = median(line.words.map((word) => word.fontHeight ?? Math.max(1, word.yMax - word.yMin)))
      ?? medianWordHeight;
    return [{
      marker,
      lineIndex,
      markerOffset: 0,
      fontHeight,
      xMin: first.xMin,
      yMin: line.yMin ?? first.yMin,
      pageHeight,
    }];
  });

  const run = findSequentialFootnoteStartRun(candidates, null, medianWordHeight);
  if (!run || run.markers.size < 3) return [];

  const runCandidates = candidates.filter((candidate, index) => run.candidateIndexes.has(index));
  if (runCandidates.length < 3) return [];

  const medianRunHeight = median(runCandidates.map((candidate) => candidate.fontHeight)) ?? medianWordHeight;
  const averageVertical = runCandidates.reduce((sum, candidate) =>
    sum + (candidate.pageHeight > 0 ? candidate.yMin / candidate.pageHeight : 0), 0) / runCandidates.length;
  const xValues = runCandidates.map((candidate) => candidate.xMin);
  const xSpread = Math.max(...xValues) - Math.min(...xValues);

  if (medianRunHeight > medianWordHeight * 1.04) return [];
  if (averageVertical < 0.52) return [];
  if (xSpread > Math.max(18, medianWordHeight * 2.2)) return [];

  return runCandidates
    .map((candidate) => ({ marker: candidate.marker, lineIndex: candidate.lineIndex }))
    .sort((left, right) => left.lineIndex - right.lineIndex);
}

function normalizeMarker(value: string): string | null {
  const canonical = value.normalize('NFKC').trim().replace(/[.)]+$/u, '');
  return /^[1-9][0-9]{0,2}$/u.test(canonical) ? canonical : null;
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}
