export interface PdfFootnoteSequenceCandidate {
  marker: string;
  lineIndex: number;
  markerOffset: number;
  fontHeight: number;
  xMin: number;
  yMin: number;
  pageHeight: number;
}

export interface PdfFootnoteSequenceRun {
  markers: Set<string>;
  candidateIndexes: Set<number>;
  score: number;
}

/**
 * Detect a structural footnote series from paragraph/line starts such as
 * `23 ...`, `24 ...`, `25 ...`. Typography and lower-page position strengthen
 * the score, but the decisive signal is an increasing numeric run.
 *
 * A fresh series requires at least three detected starts. When the previous
 * page already established the sequence, two starts are enough if the first
 * is the expected next marker. One missing/garbled number is tolerated while
 * extending a run (for example 31, 32, 34, 35).
 */
export function findSequentialFootnoteStartRun(
  candidates: readonly PdfFootnoteSequenceCandidate[],
  previousMarker: number | null,
  medianWordHeight: number,
): PdfFootnoteSequenceRun | null {
  if (!candidates.length) return null;

  const ordered = candidates
    .map((candidate, sourceIndex) => ({ candidate, sourceIndex, value: Number(candidate.marker) }))
    .filter((item) => Number.isInteger(item.value) && item.value > 0)
    .sort((left, right) => left.candidate.lineIndex - right.candidate.lineIndex
      || left.candidate.markerOffset - right.candidate.markerOffset);
  if (!ordered.length) return null;

  const runs: Array<{ items: typeof ordered; gaps: number }> = [];
  for (let start = 0; start < ordered.length; start += 1) {
    const run = [ordered[start]!];
    let gaps = 0;
    let lastValue = ordered[start]!.value;

    for (let index = start + 1; index < ordered.length; index += 1) {
      const item = ordered[index]!;
      if (item.value <= lastValue) continue;
      const delta = item.value - lastValue;
      if (delta === 1) {
        run.push(item);
        lastValue = item.value;
        continue;
      }
      if (delta === 2 && gaps === 0) {
        run.push(item);
        gaps += 1;
        lastValue = item.value;
        continue;
      }
      break;
    }

    const expectedFirst = previousMarker === null || run[0]!.value === previousMarker + 1;
    const minimumLength = previousMarker !== null && expectedFirst ? 2 : 3;
    if (run.length >= minimumLength) runs.push({ items: run, gaps });
  }

  if (!runs.length) return null;

  const scored = runs.map((run) => {
    const heights = run.items.map((item) => item.candidate.fontHeight).filter((value) => value > 0);
    const meanHeight = heights.length ? heights.reduce((sum, value) => sum + value, 0) / heights.length : medianWordHeight;
    const variance = heights.length
      ? heights.reduce((sum, value) => sum + Math.abs(value - meanHeight), 0) / heights.length
      : 0;
    const typographyConsistency = meanHeight > 0 ? Math.max(0, 1 - variance / meanHeight) : 0;
    const smallness = medianWordHeight > 0 ? Math.max(0, 1.15 - meanHeight / medianWordHeight) : 0;
    const lowerPage = run.items.reduce((sum, item) => {
      const ratio = item.candidate.pageHeight > 0 ? item.candidate.yMin / item.candidate.pageHeight : 0;
      return sum + ratio;
    }, 0) / run.items.length;
    const xValues = run.items.map((item) => item.candidate.xMin);
    const xSpread = Math.max(...xValues) - Math.min(...xValues);
    const alignment = Math.max(0, 1 - xSpread / 40);
    const expectedBonus = previousMarker !== null && run.items[0]!.value === previousMarker + 1 ? 4 : 0;
    const score = run.items.length * 10
      - run.gaps * 2
      + typographyConsistency * 3
      + smallness * 2
      + lowerPage * 2
      + alignment * 2
      + expectedBonus;
    return { run, score };
  });

  scored.sort((left, right) => right.score - left.score
    || right.run.items.length - left.run.items.length
    || left.run.items[0]!.candidate.lineIndex - right.run.items[0]!.candidate.lineIndex);
  const best = scored[0];
  if (!best) return null;

  return {
    markers: new Set(best.run.items.map((item) => item.candidate.marker)),
    candidateIndexes: new Set(best.run.items.map((item) => item.sourceIndex)),
    score: best.score,
  };
}
