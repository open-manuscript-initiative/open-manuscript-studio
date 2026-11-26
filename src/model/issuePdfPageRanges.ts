export interface IssuePdfStudyAnchors {
  rootSectionId: string;
  title: string;
  startText: string;
  endText: string;
}
export type IssuePdfRangeProblem = 'insufficient-evidence' | 'missing-anchor' | 'ambiguous-anchor' | 'reversed-range' | 'overlapping-or-out-of-order';
export interface IssuePdfRangeProposal {
  rootSectionId: string;
  title: string;
  firstPage?: number;
  lastPage?: number;
  problem?: IssuePdfRangeProblem;
  requiresReview: true;
}

/** Preserve letters and accents, but tolerate layout whitespace and discretionary breaks. */
export function normalizeIssuePdfText(value: string): string {
  return value.normalize('NFKC').replace(/\u00ad/gu, '').replace(/([\p{L}])-\s*\n\s*(?=[\p{L}])/gu, '$1')
    .replace(/\s+/gu, ' ').trim();
}

function usable(value: string): boolean {
  return value.length >= 24 && value.split(' ').length >= 4;
}

function locations(pages: readonly string[], needle: string): number[] {
  const found: number[] = [];
  for (let index = 0; index < pages.length; index++) {
    const page = pages[index]!;
    let from = 0;
    while (from <= page.length) {
      const at = page.indexOf(needle, from);
      if (at < 0) break;
      // Distinguish repeated headings on one sheet, too.
      found.push(index + 1);
      if (found.length > 1) return found;
      from = at + needle.length;
    }
  }
  return found;
}

/**
 * Text evidence is a proposal, not proof of page ownership. No inference from
 * next-start-minus-one: this would swallow inserted blanks or trailing matter.
 */
export function proposeIssuePdfRanges(pages: readonly string[], anchors: readonly IssuePdfStudyAnchors[]): IssuePdfRangeProposal[] {
  if (!pages.length || pages.length > 2000 || anchors.length > 2000) throw new Error('Invalid physical PDF page evidence.');
  const normalized = pages.map(normalizeIssuePdfText);
  const roots = new Set<string>();
  const proposals: IssuePdfRangeProposal[] = anchors.map(anchor => {
    if (!anchor.rootSectionId || roots.has(anchor.rootSectionId)) throw new Error('Duplicate study identity.');
    roots.add(anchor.rootSectionId);
    const base = { rootSectionId: anchor.rootSectionId, title: anchor.title, requiresReview: true as const };
    const start = normalizeIssuePdfText(anchor.startText), end = normalizeIssuePdfText(anchor.endText);
    if (!usable(start) || !usable(end) || start === end) return { ...base, problem: 'insufficient-evidence' };
    const starts = locations(normalized, start), ends = locations(normalized, end);
    if (!starts.length || !ends.length) return { ...base, problem: 'missing-anchor' };
    if (starts.length !== 1 || ends.length !== 1) return { ...base, problem: 'ambiguous-anchor' };
    if (starts[0]! > ends[0]!) return { ...base, problem: 'reversed-range' };
    return { ...base, firstPage: starts[0], lastPage: ends[0] };
  });
  // Compare every resolved range, including non-neighboring studies when an
  // intervening range is unresolved. Shared pages cannot be cut safely.
  const conflicts = new Set<number>();
  for (let i = 0; i < proposals.length; i++) {
    const left = proposals[i]!;
    if (left.firstPage === undefined || left.lastPage === undefined) continue;
    for (let j = i + 1; j < proposals.length; j++) {
      const right = proposals[j]!;
      if (right.firstPage !== undefined && left.lastPage >= right.firstPage) {
        conflicts.add(i); conflicts.add(j);
      }
    }
  }
  return proposals.map((proposal, i) => conflicts.has(i)
    ? { rootSectionId: proposal.rootSectionId, title: proposal.title, requiresReview: true, problem: 'overlapping-or-out-of-order' }
    : proposal);
}

/** Explicit manual review is mandatory even if the textual anchors are unique. */
export function validateReviewedIssueRanges(
  pageCount: number, expectedRoots: readonly string[],
  ranges: readonly { rootSectionId: string; firstPage: number; lastPage: number }[],
): void {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > 2000 ||
      !ranges.length || ranges.length !== expectedRoots.length || new Set(expectedRoots).size !== expectedRoots.length) throw new Error('Review every study range.');
  let previousEnd = 0;
  ranges.forEach((range, index) => {
    if (range.rootSectionId !== expectedRoots[index] ||
      !Number.isSafeInteger(range.firstPage) || !Number.isSafeInteger(range.lastPage) ||
      range.firstPage <= previousEnd || range.lastPage < range.firstPage || range.lastPage > pageCount) throw new Error('Reviewed PDF ranges must be ordered, exclusive and within the rendered issue.');
    previousEnd = range.lastPage;
  });
}
