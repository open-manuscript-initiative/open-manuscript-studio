export interface PdfGeometryWord {
  text: string;
  xMin: number;
  xMax: number;
  yMin: number;
  yMax: number;
}

export interface PdfGeometryLine<TWord extends PdfGeometryWord = PdfGeometryWord> {
  words: TWord[];
  text?: string;
  xMin?: number;
  xMax?: number;
  yMin?: number;
  yMax?: number;
}

interface MarkerCandidate<TLine extends PdfGeometryLine> {
  line: TLine;
  lineIndex: number;
  word: TLine['words'][number];
  marker: string;
  value: number;
  xMin: number;
  yMin: number;
  yCenter: number;
  markerOnly: boolean;
}

/**
 * Reconstruct visually stacked PDF footnote starts from raw bbox geometry.
 * Poppler may emit the footnote number in a separate flow/line and the note
 * text in another line even though they are visually one row. The decisive
 * signal here is a vertical column of increasing markers at almost the same x.
 *
 * Once at least three sequential markers establish a real footnote column,
 * marker-less visual rows between those starts are structural continuations of
 * the preceding note. Fold them into that note before semantic reconstruction
 * so Poppler flow breaks (including discretionary word breaks) cannot leak
 * note text back into the body.
 */
export function mergeStackedFootnoteMarkerRows<TLine extends PdfGeometryLine>(lines: TLine[]): void {
  if (lines.length < 3) return;

  const candidates = collectCandidates(lines);
  if (candidates.length < 3) return;

  const runs = findAlignedRuns(candidates);
  if (!runs.length) return;

  const best = runs.sort((left, right) => right.score - left.score || right.items.length - left.items.length)[0];
  if (!best || best.items.length < 3) return;

  const removeIndexes = new Set<number>();
  const reservedTargets = new Set<number>();

  for (const candidate of best.items) {
    if (!candidate.markerOnly || removeIndexes.has(candidate.lineIndex)) continue;

    const targetIndex = findContentTarget(lines, candidate, reservedTargets, best.xCenter);
    if (targetIndex < 0) continue;

    const target = lines[targetIndex]!;
    target.words.unshift(candidate.word);
    target.text = target.words.map((word) => word.text).join(' ').replace(/\s+/gu, ' ').trim();
    if (typeof target.xMin === 'number') target.xMin = Math.min(target.xMin, candidate.word.xMin);
    if (typeof target.yMin === 'number') target.yMin = Math.min(target.yMin, candidate.word.yMin);
    if (typeof target.yMax === 'number') target.yMax = Math.max(target.yMax, candidate.word.yMax);

    removeIndexes.add(candidate.lineIndex);
    reservedTargets.add(targetIndex);
  }

  // A sequential, vertically aligned run is strong enough evidence to define
  // the local footnote zone. Keep every plausible marker-less row between two
  // confirmed starts with the preceding note instead of asking the later body
  // continuation heuristic to rediscover that relationship.
  mergeConfirmedZoneContinuations(lines, best.items, best.xCenter, removeIndexes);

  if (!removeIndexes.size) return;
  for (const index of [...removeIndexes].sort((left, right) => right - left)) {
    lines.splice(index, 1);
  }
}

function mergeConfirmedZoneContinuations<TLine extends PdfGeometryLine>(
  lines: TLine[],
  runItems: readonly MarkerCandidate<TLine>[],
  markerColumnX: number,
  removeIndexes: Set<number>,
): void {
  const starts = runItems
    .map((item) => resolveMarkerStartLine(lines, item, removeIndexes))
    .filter((item): item is { marker: MarkerCandidate<TLine>; lineIndex: number } => item !== null)
    .sort((left, right) => left.marker.yCenter - right.marker.yCenter);
  if (starts.length < 3) return;

  for (let startIndex = 0; startIndex < starts.length - 1; startIndex += 1) {
    const current = starts[startIndex]!;
    const next = starts[startIndex + 1]!;
    const target = lines[current.lineIndex]!;
    const targetHeight = median(target.words.map((word) => Math.max(1, word.yMax - word.yMin))) ?? 8;
    const contentX = target.words.length > 1 ? target.words[1]!.xMin : markerColumnX + targetHeight;

    const continuations = lines
      .map((line, lineIndex) => ({ line, lineIndex }))
      .filter(({ line, lineIndex }) => {
        if (lineIndex === current.lineIndex || lineIndex === next.lineIndex || removeIndexes.has(lineIndex)) return false;
        if (!line.words.length) return false;
        const first = line.words[0]!;
        if (parseMarker(first.text)) return false;
        const center = lineCenter(line);
        if (center <= current.marker.yCenter || center >= next.marker.yCenter) return false;
        const lineHeight = median(line.words.map((word) => Math.max(1, word.yMax - word.yMin))) ?? targetHeight;
        if (lineHeight > targetHeight * 1.28) return false;
        // Note continuations normally start at the note-text indent, not in the
        // marker column or the main body margin.
        return first.xMin >= markerColumnX + Math.max(4, targetHeight * 0.35)
          && first.xMin <= contentX + Math.max(24, targetHeight * 2.5);
      })
      .sort((left, right) => lineCenter(left.line) - lineCenter(right.line));

    for (const continuation of continuations) {
      target.words.push(...continuation.line.words);
      target.text = target.words.map((word) => word.text).join(' ').replace(/\s+/gu, ' ').trim();
      if (typeof target.xMax === 'number' && typeof continuation.line.xMax === 'number') {
        target.xMax = Math.max(target.xMax, continuation.line.xMax);
      }
      if (typeof target.yMax === 'number' && typeof continuation.line.yMax === 'number') {
        target.yMax = Math.max(target.yMax, continuation.line.yMax);
      }
      removeIndexes.add(continuation.lineIndex);
    }
  }
}

function resolveMarkerStartLine<TLine extends PdfGeometryLine>(
  lines: readonly TLine[],
  marker: MarkerCandidate<TLine>,
  removed: ReadonlySet<number>,
): { marker: MarkerCandidate<TLine>; lineIndex: number } | null {
  if (!removed.has(marker.lineIndex)) return { marker, lineIndex: marker.lineIndex };

  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < lines.length; index += 1) {
    if (removed.has(index)) continue;
    const line = lines[index]!;
    if (!line.words.length || line.words[0] !== marker.word) continue;
    const distance = Math.abs(lineCenter(line) - marker.yCenter);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  }
  return bestIndex >= 0 ? { marker, lineIndex: bestIndex } : null;
}

function lineCenter(line: PdfGeometryLine): number {
  if (typeof line.yMin === 'number' && typeof line.yMax === 'number') return (line.yMin + line.yMax) / 2;
  if (!line.words.length) return 0;
  return median(line.words.map((word) => (word.yMin + word.yMax) / 2)) ?? 0;
}

function collectCandidates<TLine extends PdfGeometryLine>(lines: TLine[]): MarkerCandidate<TLine>[] {
  const candidates: MarkerCandidate<TLine>[] = [];

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const line = lines[lineIndex]!;
    if (!line.words.length) continue;

    const word = line.words[0]!;
    const marker = parseMarker(word.text);
    if (!marker) continue;

    candidates.push({
      line,
      lineIndex,
      word,
      marker,
      value: Number(marker),
      xMin: word.xMin,
      yMin: word.yMin,
      yCenter: (word.yMin + word.yMax) / 2,
      markerOnly: line.words.length === 1,
    });
  }

  return candidates.sort((left, right) => left.yMin - right.yMin || left.xMin - right.xMin);
}

function findAlignedRuns<TLine extends PdfGeometryLine>(candidates: readonly MarkerCandidate<TLine>[]) {
  const runs: Array<{ items: MarkerCandidate<TLine>[]; score: number; xCenter: number }> = [];

  for (let start = 0; start < candidates.length; start += 1) {
    const seed = candidates[start]!;
    const items = [seed];
    let last = seed;
    let gapUsed = false;

    for (let index = start + 1; index < candidates.length; index += 1) {
      const current = candidates[index]!;
      if (current.yCenter <= last.yCenter) continue;

      const xCenter = median(items.map((item) => item.xMin)) ?? seed.xMin;
      const xTolerance = Math.max(7, averageHeight(items) * 0.9);
      if (Math.abs(current.xMin - xCenter) > xTolerance) continue;

      const delta = current.value - last.value;
      if (delta === 1) {
        items.push(current);
        last = current;
        continue;
      }
      if (delta === 2 && !gapUsed) {
        items.push(current);
        last = current;
        gapUsed = true;
        continue;
      }
      if (current.value <= last.value) continue;
      break;
    }

    if (items.length < 3) continue;

    const xValues = items.map((item) => item.xMin);
    const xCenter = median(xValues) ?? seed.xMin;
    const xSpread = Math.max(...xValues) - Math.min(...xValues);
    const markerOnlyCount = items.filter((item) => item.markerOnly).length;
    const yGaps = items.slice(1).map((item, index) => item.yCenter - items[index]!.yCenter);
    const yGapMedian = median(yGaps) ?? 0;
    const yConsistency = yGapMedian > 0
      ? 1 - Math.min(1, (median(yGaps.map((gap) => Math.abs(gap - yGapMedian))) ?? 0) / yGapMedian)
      : 0;

    const score = items.length * 12
      + markerOnlyCount * 2
      + Math.max(0, 8 - xSpread)
      + yConsistency * 4
      - (gapUsed ? 2 : 0);

    runs.push({ items, score, xCenter });
  }

  return runs;
}

function findContentTarget<TLine extends PdfGeometryLine>(
  lines: readonly TLine[],
  marker: MarkerCandidate<TLine>,
  reservedTargets: ReadonlySet<number>,
  markerColumnX: number,
): number {
  const markerHeight = Math.max(1, marker.word.yMax - marker.word.yMin);
  let bestIndex = -1;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let index = 0; index < lines.length; index += 1) {
    if (index === marker.lineIndex || reservedTargets.has(index)) continue;
    const line = lines[index]!;
    if (!line.words.length) continue;

    const first = line.words[0]!;
    if (parseMarker(first.text)) continue;

    const horizontalGap = first.xMin - marker.word.xMax;
    if (horizontalGap < -1 || horizontalGap > Math.max(28, markerHeight * 3.5)) continue;
    if (first.xMin <= markerColumnX) continue;

    const contentHeight = median(line.words.map((word) => Math.max(1, word.yMax - word.yMin)))
      ?? Math.max(1, first.yMax - first.yMin);
    const contentCenter = (first.yMin + first.yMax) / 2;
    const centerDistance = Math.abs(marker.yCenter - contentCenter);
    if (centerDistance > Math.max(5.5, contentHeight * 0.48)) continue;

    const verticalOverlap = Math.min(marker.word.yMax, first.yMax) - Math.max(marker.word.yMin, first.yMin);
    const overlapPenalty = verticalOverlap > 0 ? 0 : Math.abs(verticalOverlap) * 2;
    const score = centerDistance * 4 + horizontalGap * 0.12 + overlapPenalty;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }

  return bestIndex;
}

function averageHeight<TLine extends PdfGeometryLine>(items: readonly MarkerCandidate<TLine>[]): number {
  if (!items.length) return 8;
  return items.reduce((sum, item) => sum + Math.max(1, item.word.yMax - item.word.yMin), 0) / items.length;
}

function parseMarker(value: string): string | null {
  const canonical = value.normalize('NFKC').trim().replace(/[.)]+$/u, '');
  return /^[1-9][0-9]{0,2}$/u.test(canonical) ? canonical : null;
}

function median(values: readonly number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.floor(sorted.length / 2)] ?? null;
}
