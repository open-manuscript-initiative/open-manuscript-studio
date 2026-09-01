export interface PdfVisualWord {
  text: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface PdfVisualLine<TWord extends PdfVisualWord = PdfVisualWord> {
  words: TWord[];
  text?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

interface WordSource<TLine extends PdfVisualLine> {
  word: TLine['words'][number];
  source: TLine;
  sourceIndex: number;
  centerY: number;
  height: number;
}

interface VisualBand<TLine extends PdfVisualLine> {
  items: WordSource<TLine>[];
  centerY: number;
  height: number;
}

/**
 * Rebuild visual text rows directly from raw bbox words before any semantic PDF
 * analysis. Poppler's <line>/<flow> grouping is useful but not authoritative:
 * it can flatten several printed footnote rows into one logical line or split a
 * printed row across multiple flows. The bbox coordinates remain reliable.
 *
 * Every source word is assigned exactly once. First we cluster words by visual
 * baseline/vertical overlap, then split a band at genuinely large horizontal
 * gaps (for example between page columns). The resulting rows replace Poppler's
 * logical rows while preserving the source line's page-level metadata through
 * object spread.
 */
export function reconstructPdfVisualRows<TLine extends PdfVisualLine>(lines: TLine[]): void {
  if (lines.length < 2) return;

  const words = lines.flatMap((source, sourceIndex) => source.words.map((word) => ({
    word,
    source,
    sourceIndex,
    centerY: (word.yMin + word.yMax) / 2,
    height: Math.max(1, word.yMax - word.yMin),
  } satisfies WordSource<TLine>)));
  if (words.length < 3) return;

  const bands: VisualBand<TLine>[] = [];
  const ordered = [...words].sort((left, right) => left.centerY - right.centerY || left.word.xMin - right.word.xMin);

  for (const item of ordered) {
    let best: VisualBand<TLine> | null = null;
    let bestScore = Number.POSITIVE_INFINITY;

    for (const band of bands) {
      const centerDistance = Math.abs(item.centerY - band.centerY);
      const minHeight = Math.max(1, Math.min(item.height, band.height));
      const tolerance = Math.max(2.2, minHeight * 0.3);
      const overlap = verticalOverlap(item.word, band.items.map((entry) => entry.word));
      const overlapRatio = overlap / minHeight;

      // Tight scholarly footnotes often have adjacent rows whose glyph boxes
      // overlap vertically. Treat overlap as corroborating evidence only: it may
      // rescue a slightly shifted superscript/baseline fragment, but it must not
      // merge two distinct rows merely because their bounding boxes intersect.
      const overlapRescue = overlapRatio >= 0.7
        && centerDistance <= Math.max(3.4, minHeight * 0.5);
      if (centerDistance > tolerance && !overlapRescue) continue;

      const score = centerDistance - overlapRatio * 1.25;
      if (score < bestScore) {
        best = band;
        bestScore = score;
      }
    }

    if (!best) {
      bands.push({ items: [item], centerY: item.centerY, height: item.height });
      continue;
    }

    best.items.push(item);
    best.centerY = median(best.items.map((entry) => entry.centerY)) ?? best.centerY;
    best.height = median(best.items.map((entry) => entry.height)) ?? best.height;
  }

  const rebuilt: TLine[] = [];
  for (const band of bands.sort((left, right) => left.centerY - right.centerY)) {
    const bandItems = [...band.items].sort((left, right) => left.word.xMin - right.word.xMin);
    const typicalHeight = median(bandItems.map((item) => item.height)) ?? 8;
    const segments: WordSource<TLine>[][] = [];
    let current: WordSource<TLine>[] = [];

    for (const item of bandItems) {
      const previous = current.at(-1);
      if (previous) {
        const gap = item.word.xMin - previous.word.xMax;
        // Normal inter-word spacing is only a few points. A much larger gap is
        // evidence for a distinct visual row/column at the same y position.
        const splitGap = Math.max(34, typicalHeight * 4.5);
        if (gap > splitGap) {
          segments.push(current);
          current = [];
        }
      }
      current.push(item);
    }
    if (current.length) segments.push(current);

    for (const segment of segments) {
      if (!segment.length) continue;
      const rowWords = segment.map((item) => item.word).sort((left, right) => left.xMin - right.xMin);
      const base = chooseBaseSource(segment);
      const xMin = Math.min(...rowWords.map((word) => word.xMin));
      const xMax = Math.max(...rowWords.map((word) => word.xMax));
      const yMin = Math.min(...rowWords.map((word) => word.yMin));
      const yMax = Math.max(...rowWords.map((word) => word.yMax));
      rebuilt.push({
        ...base,
        words: rowWords,
        text: rowWords.map((word) => word.text).join(' ').replace(/\s+/gu, ' ').trim(),
        xMin,
        xMax,
        yMin,
        yMax,
      } as TLine);
    }
  }

  if (!rebuilt.length) return;
  rebuilt.sort((left, right) => (left.yMin ?? 0) - (right.yMin ?? 0) || (left.xMin ?? 0) - (right.xMin ?? 0));
  lines.splice(0, lines.length, ...rebuilt);
}

function chooseBaseSource<TLine extends PdfVisualLine>(segment: readonly WordSource<TLine>[]): TLine {
  const counts = new Map<number, number>();
  for (const item of segment) counts.set(item.sourceIndex, (counts.get(item.sourceIndex) ?? 0) + 1);
  const bestIndex = [...counts.entries()].sort((left, right) => right[1] - left[1] || left[0] - right[0])[0]?.[0]
    ?? segment[0]!.sourceIndex;
  return segment.find((item) => item.sourceIndex === bestIndex)?.source ?? segment[0]!.source;
}

function verticalOverlap(word: PdfVisualWord, others: readonly PdfVisualWord[]): number {
  let best = 0;
  for (const other of others) {
    best = Math.max(best, Math.min(word.yMax, other.yMax) - Math.max(word.yMin, other.yMin));
  }
  return Math.max(0, best);
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}
