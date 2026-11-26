export interface PublicationFlowBlock {
  sectionId?: string;
  top: number;
  height: number;
  noteIds?: readonly string[];
  lines?: readonly PublicationFlowLine[];
  leadingHeight?: number;
  splittable?: boolean;
  keepWithNext?: boolean;
  keepTogether?: boolean;
  forcePageBreakBefore?: boolean;
  keepSectionTogether?: boolean;
  keepSectionId?: string;
  insertedPagesBefore?: readonly { id: string; styleId?: string }[];
  insertedPagesAfter?: readonly { id: string; styleId?: string }[];
}

export interface PublicationFlowLine {
  noteIds?: readonly string[];
  textOffset: number;
  top: number;
  height: number;
}

export interface PublicationFlowBreak {
  pageIndex: number;
  blockIndex: number;
  textOffset: number;
  height: number;
}

export interface PublicationBlockPlacement {
  pageIndex: number;
  translateY: number;
}

export interface PublicationPageLayout {
  pageCount: number;
  placements: PublicationBlockPlacement[];
  flowBreaks: PublicationFlowBreak[];
  pageNotes?: PublicationPageNote[][];
  pageSectionIds?: (string | undefined)[];
  insertedPages?: { pageIndex: number; id: string; styleId?: string }[];
  sectionWarnings?: { sectionId: string; firstPage: number; lastPage: number; reason: 'continued' | 'moved' | 'oversized' }[];
}

export interface PublicationPageMetrics {
  bodyHeight: number;
  /** Absolute body top relative to the first page's body top. */
  bodyTop: number;
}

/**
 * Cache page geometry and the cumulative height of preceding sheets.
 * Section-master changes can invalidate an earlier page after a later page
 * was measured (for example, while reserving continued footnotes).
 */
export interface PublicationPageMetricsSnapshot {
  insertionStyles: Map<number, string>;
  heights: number[];
  prefix: number[];
  cache: ({ sectionId?: string } & PublicationPageMetrics)[];
}

export function createPublicationPageMetricsResolver(
  geometryFor: (index: number, sectionId?: string, insertedStyleId?: string) => { height: number; bodyHeight: number; topMargin: number },
  pageGap: number,
  firstTopMargin: number,
) {
  const insertionStyles = new Map<number, string>();
  const heights: number[] = [];
  const prefix: number[] = [0];
  const cache: ({ sectionId?: string } & PublicationPageMetrics)[] = [];
  const sumBefore = (index: number) => {
    while (prefix.length <= index) {
      const preceding = prefix.length - 1;
      prefix.push(prefix[preceding]! + (heights[preceding] ?? 0));
    }
    return prefix[index]!;
  };
  const metrics = (index: number, sectionId?: string, insertedStyleId?: string): PublicationPageMetrics => {
    if (insertedStyleId !== undefined && insertionStyles.get(index) !== insertedStyleId) {
      insertionStyles.set(index, insertedStyleId);
      delete cache[index];
    }
    const cached = cache[index];
    if (cached && cached.sectionId === sectionId) return cached;
    const geometry = geometryFor(index, sectionId, insertionStyles.get(index));
    const stride = geometry.height + pageGap;
    if (heights[index] !== stride) {
      heights[index] = stride;
      if (prefix.length > index + 1) prefix.length = index + 1;
    }
    const measured = {
      sectionId, bodyHeight: geometry.bodyHeight,
      bodyTop: sumBefore(index) + geometry.topMargin - firstTopMargin,
    };
    // Preserve the old invalidation contract: later absolute positions must
    // be recomputed after a changed section or inserted-page master.
    if (cache.length > index) cache.length = index;
    cache[index] = measured;
    return measured;
  };
  const snapshot = (): PublicationPageMetricsSnapshot => ({
    insertionStyles: new Map(insertionStyles), heights: heights.slice(), prefix: prefix.slice(), cache: cache.slice(),
  });
  const restore = (saved: PublicationPageMetricsSnapshot) => {
    insertionStyles.clear(); for (const [index, style] of saved.insertionStyles) insertionStyles.set(index, style);
    heights.length = 0; heights.length = saved.heights.length; saved.heights.forEach((value, index) => { heights[index] = value; });
    prefix.length = 0; for (const value of saved.prefix) prefix.push(value);
    cache.length = 0; cache.length = saved.cache.length; saved.cache.forEach((value, index) => { cache[index] = value; });
  };
  return { metrics, insertionStyles, snapshot, restore };
}

/**
 * Maps the editor's continuous block flow onto screen pages.
 *
 * Pagination is deliberately presentation-only: no page breaks or cached page
 * numbers are written into the OMI document. Splittable text blocks continue
 * line by line across pages. Only non-splittable blocks and explicit
 * keep-together rules move a complete block to the following page.
 */
export function paginatePublicationBlocks(
  blocks: readonly PublicationFlowBlock[],
  usablePageHeight: number,
  pageOverhead: number,
  footnotes?: PublicationFootnotes,
  pageMetrics?: (index: number, sectionId?: string, insertedStyleId?: string) => PublicationPageMetrics,
): PublicationPageLayout {
  if (pageMetrics) return paginateStyledPages(blocks, pageMetrics, footnotes);
  if (footnotes && blocks.some((block) => block.noteIds?.length || block.lines?.some((line) => line.noteIds?.length))) {
    return paginateWithFootnotes(blocks, usablePageHeight, pageOverhead, footnotes);
  }
  return paginateFixedPublicationBlocks(blocks, usablePageHeight, pageOverhead);
}

interface FixedLayoutCheckpoint {
  insertedSpace: number;
  insertedInlineHeight: number;
  lastOccupiedPage: number;
  flowBreakCount: number;
}

interface FixedLayoutSnapshot {
  blocks: readonly PublicationFlowBlock[];
  bodyHeight: number;
  chromeHeight: number;
  checkpoints: FixedLayoutCheckpoint[];
  layout: PublicationPageLayout;
}

function sameFixedBlock(left: PublicationFlowBlock, right: PublicationFlowBlock): boolean {
  if (left === right) return true;
  return left.top === right.top && left.height === right.height
    && left.leadingHeight === right.leadingHeight && left.splittable === right.splittable
    && left.keepWithNext === right.keepWithNext && left.keepTogether === right.keepTogether
    && left.forcePageBreakBefore === right.forcePageBreakBefore
    && (left.lines?.length ?? 0) === (right.lines?.length ?? 0)
    && (left.lines ?? []).every((line, index) => {
      const other = right.lines?.[index];
      return other?.textOffset === line.textOffset && other.top === line.top && other.height === line.height;
    });
}

function sameOrdered<T>(left: readonly T[] | undefined, right: readonly T[] | undefined, equal: (a: T, b: T) => boolean): boolean {
  return (left?.length ?? 0) === (right?.length ?? 0) && (left ?? []).every((item, index) => equal(item, right![index]!));
}

function sameComplexBlock(left: PublicationFlowBlock, right: PublicationFlowBlock): boolean {
  return sameFixedBlock(left, right) && left.sectionId === right.sectionId
    && left.keepSectionTogether === right.keepSectionTogether && left.keepSectionId === right.keepSectionId
    && sameOrdered(left.noteIds, right.noteIds, (a, b) => a === b)
    && sameOrdered(left.lines, right.lines, (a, b) => sameOrdered(a.noteIds, b.noteIds, (x, y) => x === y))
    && sameOrdered(left.insertedPagesBefore, right.insertedPagesBefore, (a, b) => a.id === b.id && a.styleId === b.styleId)
    && sameOrdered(left.insertedPagesAfter, right.insertedPagesAfter, (a, b) => a.id === b.id && a.styleId === b.styleId);
}

function sameFootnoteGeometry(left: PublicationFootnotes | undefined, right: PublicationFootnotes | undefined): boolean {
  if (!left || !right) return left === right;
  return left.lineHeight === right.lineHeight && left.separatorHeight === right.separatorHeight
    && left.allowPageContinuation === right.allowPageContinuation && left.heights.size === right.heights.size
    && [...left.heights].every(([id, height]) => right.heights.get(id) === height);
}

interface ComplexPaginationCheckpoint {
  blockIndex: number;
  page: number;
  position: number;
  naturalBottom: number;
  inlineHeight: number;
  previousDelta: number;
  pageNotes: PublicationPageNote[][];
  pageNoteHeights: number[];
  seen: Set<string>;
  placements: PublicationBlockPlacement[];
  flowBreaks: PublicationFlowBreak[];
  pageSectionIds?: (string | undefined)[];
  insertedPages?: NonNullable<PublicationPageLayout['insertedPages']>;
  movedSections?: Set<string>;
  metricsState?: PublicationPageMetricsSnapshot;
}

interface ComplexPaginationResume {
  checkpoint?: ComplexPaginationCheckpoint;
  retain: ComplexPaginationCheckpoint[];
  preparedMetrics?: PublicationPreparedMetrics;
  bytes: number;
  limit: number;
}

const MAX_COMPLEX_CHECKPOINTS = 3;
const MAX_COMPLEX_CHECKPOINT_BYTES = 8 * 1024 * 1024;

function checkpointBytes(checkpoint: ComplexPaginationCheckpoint): number {
  // Conservative estimate of copied references, containers, and metric entries.
  return 512 + checkpoint.placements.length * 16 + checkpoint.flowBreaks.length * 16
    + checkpoint.pageNoteHeights.length * 16 + checkpoint.seen.size * 96
    + checkpoint.pageNotes.reduce((sum, fragments) => sum + 64 + fragments.length * 16, 0)
    + (checkpoint.pageSectionIds?.length ?? 0) * 16 + (checkpoint.insertedPages?.length ?? 0) * 16
    + (checkpoint.movedSections?.size ?? 0) * 96
    + (checkpoint.metricsState ? (checkpoint.metricsState.heights.length + checkpoint.metricsState.prefix.length
      + checkpoint.metricsState.cache.length) * 24 + checkpoint.metricsState.insertionStyles.size * 96 : 0);
}

function firstKeepSectionIndexes(blocks: readonly PublicationFlowBlock[]): Map<string | undefined, number> {
  const first = new Map<string | undefined, number>();
  blocks.forEach((block, index) => {
    const id = block.keepSectionId ?? block.sectionId;
    if (block.keepSectionTogether && !first.has(id)) first.set(id, index);
  });
  return first;
}

function safeComplexBoundary(blocks: readonly PublicationFlowBlock[], index: number, keepSections?: ReadonlyMap<string | undefined, number>): boolean {
  if (index <= 0 || index > blocks.length || blocks[index - 1]?.keepWithNext) return false;
  if (!keepSections || index === blocks.length) return true;
  const next = blocks[index]!;
  // A keep-section group that started earlier must not look across the checkpoint.
  return (keepSections.get(next.keepSectionId ?? next.sectionId) ?? Infinity) >= index;
}

function sameNotePolicy(a?: PublicationFootnotes, b?: PublicationFootnotes): boolean {
  return !a || !b ? a === b : a.lineHeight === b.lineHeight
    && a.separatorHeight === b.separatorHeight && a.allowPageContinuation === b.allowPageContinuation;
}

function unchangedComplexPrefix(previous: ComplexLayoutSnapshot, blocks: readonly PublicationFlowBlock[], notes?: PublicationFootnotes): number {
  if (!sameNotePolicy(previous.footnotes, notes)) return 0;
  const equalNote = (id: string) => previous.footnotes?.heights.get(id) === notes?.heights.get(id)
    && previous.footnotes?.heights.has(id) === notes?.heights.has(id);
  let index = 0;
  while (index < blocks.length && index < previous.blocks.length) {
    const block = blocks[index]!;
    if (!sameComplexBlock(previous.blocks[index]!, block)
      || block.noteIds?.some(id => !equalNote(id))
      || block.lines?.some(line => line.noteIds?.some(id => !equalNote(id)))) break;
    index += 1;
  }
  return index;
}

function complexResume(previous: ComplexLayoutSnapshot | undefined, blocks: readonly PublicationFlowBlock[],
  notes: PublicationFootnotes | undefined, preparedMetrics: PublicationPreparedMetrics | undefined, limit: number): ComplexPaginationResume {
  const prefix = previous ? unchangedComplexPrefix(previous, blocks, notes) : 0;
  const keepSections = preparedMetrics ? firstKeepSectionIndexes(blocks) : undefined;
  const retain = (previous?.checkpoints ?? []).filter(cp => cp.blockIndex <= prefix
    && safeComplexBoundary(blocks, cp.blockIndex, keepSections));
  const bytes = retain.reduce((sum, cp) => sum + checkpointBytes(cp), 0);
  if (bytes > limit) return { retain: [], preparedMetrics, bytes: 0, limit };
  return { checkpoint: retain.at(-1), retain, preparedMetrics, bytes, limit };
}

function wantsComplexCheckpoint(resume: ComplexPaginationResume | undefined, blocks: readonly PublicationFlowBlock[],
  index: number, keepSections?: ReadonlyMap<string | undefined, number>): boolean {
  return !!resume && blocks.length >= 96 && resume.retain.length < MAX_COMPLEX_CHECKPOINTS
    && resume.bytes < resume.limit && index < blocks.length
    && index >= Math.ceil(blocks.length * (resume.retain.length + 1) / (MAX_COMPLEX_CHECKPOINTS + 1))
    && safeComplexBoundary(blocks, index, keepSections);
}

function retainComplexCheckpoint(resume: ComplexPaginationResume, checkpoint: ComplexPaginationCheckpoint) {
  const bytes = checkpointBytes(checkpoint);
  if (resume.bytes + bytes > resume.limit) {
    resume.bytes = resume.limit;
    return;
  }
  resume.retain.push(checkpoint);
  resume.bytes += bytes;
}

interface ComplexLayoutSnapshot {
  blocks: readonly PublicationFlowBlock[];
  bodyHeight: number;
  pageOverhead: number;
  footnotes?: PublicationFootnotes;
  geometryKey?: object;
  metricsState?: PublicationPageMetricsSnapshot;
  checkpoints: ComplexPaginationCheckpoint[];
  layout: PublicationPageLayout;
}

export interface PublicationPreparedMetrics {
  /** Identifies all inputs affecting page geometry, stable for one canvas effect. */
  key: object;
  snapshot: () => PublicationPageMetricsSnapshot;
  restore: (snapshot: PublicationPageMetricsSnapshot) => void;
}

/**
 * One canvas owns one cache. Inputs and returned layouts are immutable
 * snapshots. Complex pages can reuse a complete result only when every
 * measured layout input matches and the prepared metrics state can be restored.
 */
/** Estimated retained layout cost; not a JS heap measurement. */
function measuredInputBytes(blocks: readonly PublicationFlowBlock[], notes?: PublicationFootnotes): number {
  return 1024 + (notes?.heights.size ?? 0) * 128 + blocks.reduce((sum, block) => sum + 256
    + (block.noteIds?.length ?? 0) * 64
    + (block.lines ?? []).reduce((lineSum, line) => lineSum + 128 + (line.noteIds?.length ?? 0) * 64, 0)
    + ((block.insertedPagesBefore?.length ?? 0) + (block.insertedPagesAfter?.length ?? 0)) * 128, 0);
}

function layoutBytes(layout: PublicationPageLayout): number {
  return 512 + layout.placements.length * 64 + layout.flowBreaks.length * 96
    + (layout.pageNotes ?? []).reduce((sum, notes) => sum + 64 + notes.length * 96, 0)
    + (layout.pageSectionIds?.length ?? 0) * 64 + (layout.insertedPages?.length ?? 0) * 128
    + (layout.sectionWarnings?.length ?? 0) * 128;
}

export function createIncrementalPublicationPaginator() {
  let previous: FixedLayoutSnapshot | undefined;
  let complex: ComplexLayoutSnapshot | undefined;
  let budgetBytes = 16 * 1024 * 1024;
  const clear = () => { previous = undefined; complex = undefined; };
  return {
    setBudget(bytes: number) {
      const next = Number.isFinite(bytes) ? Math.max(0, Math.floor(bytes)) : 0;
      if (next < budgetBytes) clear();
      budgetBytes = next;
    },
    paginate(
      blocks: readonly PublicationFlowBlock[],
      usablePageHeight: number,
      pageOverhead: number,
      footnotes?: PublicationFootnotes,
      pageMetrics?: (index: number, sectionId?: string, insertedStyleId?: string) => PublicationPageMetrics,
      preparedMetrics?: PublicationPreparedMetrics,
    ): PublicationPageLayout {
      const inputBytes = measuredInputBytes(blocks, footnotes);
      if (budgetBytes === 0 || inputBytes >= budgetBytes) {
        clear();
        return paginatePublicationBlocks(blocks, usablePageHeight, pageOverhead, footnotes, pageMetrics);
      }
      if (pageMetrics || (footnotes && blocks.some((block) => block.noteIds?.length || block.lines?.some((line) => line.noteIds?.length)))) {
        previous = undefined;
        const canCache = !pageMetrics || !!preparedMetrics;
        if (canCache && complex && complex.geometryKey === (pageMetrics ? preparedMetrics?.key : undefined)
          && complex.bodyHeight === usablePageHeight && complex.pageOverhead === pageOverhead
          && sameFootnoteGeometry(complex.footnotes, footnotes)
          && sameOrdered(complex.blocks, blocks, sameComplexBlock)) {
          if (complex.metricsState) preparedMetrics?.restore(complex.metricsState);
          return complex.layout;
        }
        const compatible = canCache && complex && complex.geometryKey === (pageMetrics ? preparedMetrics?.key : undefined)
          && complex.bodyHeight === usablePageHeight && complex.pageOverhead === pageOverhead ? complex : undefined;
        const resume = canCache ? complexResume(compatible, blocks, footnotes, preparedMetrics,
          Math.min(MAX_COMPLEX_CHECKPOINT_BYTES, Math.floor((budgetBytes - inputBytes) / 2))) : undefined;
        const layout = pageMetrics ? paginateStyledPages(blocks, pageMetrics, footnotes, resume)
          : paginateWithFootnotes(blocks, usablePageHeight, pageOverhead, footnotes!, resume);
        const metricsState = pageMetrics && canCache ? preparedMetrics?.snapshot() : undefined;
        const metricBytes = metricsState ? (metricsState.heights.length + metricsState.prefix.length + metricsState.cache.length) * 96
          + metricsState.insertionStyles.size * 128 : 0;
        const fits = inputBytes + layoutBytes(layout) + metricBytes + (resume?.bytes ?? 0) <= budgetBytes;
        complex = canCache && fits ? { blocks, bodyHeight: usablePageHeight, pageOverhead,
          footnotes: footnotes ? { ...footnotes, heights: new Map(footnotes.heights) } : undefined,
          geometryKey: pageMetrics ? preparedMetrics?.key : undefined,
          metricsState, checkpoints: resume?.retain ?? [], layout } : undefined;
        return layout;
      }
      complex = undefined;
      return paginateFixedPublicationBlocks(blocks, usablePageHeight, pageOverhead, previous, (snapshot) => {
        previous = inputBytes + layoutBytes(snapshot.layout) + snapshot.checkpoints.length * 64 <= budgetBytes ? snapshot : undefined;
      });
    },
    clear,
  };
}

function paginateFixedPublicationBlocks(
  blocks: readonly PublicationFlowBlock[],
  usablePageHeight: number,
  pageOverhead: number,
  previous?: FixedLayoutSnapshot,
  retain?: (snapshot: FixedLayoutSnapshot) => void,
): PublicationPageLayout {
  const bodyHeight = positive(usablePageHeight, 1);
  const chromeHeight = nonNegative(pageOverhead);
  let resume = 0;
  let suffixStart = blocks.length;
  if (previous && previous.bodyHeight === bodyHeight && previous.chromeHeight === chromeHeight) {
    while (resume < blocks.length && resume < previous.blocks.length
      && sameFixedBlock(blocks[resume]!, previous.blocks[resume]!)) resume += 1;
    if (resume === blocks.length && resume === previous.blocks.length) return previous.layout;
    if (blocks.length === previous.blocks.length) {
      while (suffixStart > resume && sameFixedBlock(blocks[suffixStart - 1]!, previous.blocks[suffixStart - 1]!)) suffixStart -= 1;
    }
    // The preceding block may keep with the changed block, even when its own
    // geometry is identical. Recompute it too, including append/delete cases.
    resume = Math.max(0, resume - 1);
  }
  const checkpoint = resume > 0 ? previous?.checkpoints[resume - 1] : undefined;
  let insertedSpace = checkpoint?.insertedSpace ?? 0;
  let insertedInlineHeight = checkpoint?.insertedInlineHeight ?? 0;
  let lastOccupiedPage = checkpoint?.lastOccupiedPage ?? 0;
  const flowBreaks: PublicationFlowBreak[] = checkpoint ? previous!.layout.flowBreaks.slice(0, checkpoint.flowBreakCount) : [];
  const placements: PublicationBlockPlacement[] = resume ? previous!.layout.placements.slice(0, resume) : [];
  const checkpoints: FixedLayoutCheckpoint[] = resume ? previous!.checkpoints.slice(0, resume) : [];

  for (let index = resume; index < blocks.length; index += 1) {
    // At an unchanged suffix, all the future inputs (including keep-with-next
    // lookahead) and the carried geometry must match exactly before reuse.
    const stable = previous && index >= suffixStart && index > 0 ? previous.checkpoints[index - 1] : undefined;
    if (stable && stable.insertedSpace === insertedSpace && stable.insertedInlineHeight === insertedInlineHeight
      && stable.lastOccupiedPage === lastOccupiedPage && stable.flowBreakCount === flowBreaks.length) {
      for (let i = index; i < previous!.layout.placements.length; i++) placements.push(previous!.layout.placements[i]!);
      for (let i = stable.flowBreakCount; i < previous!.layout.flowBreaks.length; i++) flowBreaks.push(previous!.layout.flowBreaks[i]!);
      for (let i = index; i < previous!.checkpoints.length; i++) checkpoints.push(previous!.checkpoints[i]!);
      lastOccupiedPage = previous!.checkpoints.at(-1)!.lastOccupiedPage;
      break;
    }
    const block = blocks[index]!;
    const naturalTop = nonNegative(block.top);
    const blockHeight = nonNegative(block.height);
    const nextBlock = blocks[index + 1];
    const nextLeadingHeight = nonNegative(
      nextBlock?.leadingHeight
        ?? nextBlock?.lines?.[0]?.height
        ?? nextBlock?.height
        ?? 0,
    );
    const nextBlockGap = nextBlock
      ? Math.max(0, nonNegative(nextBlock.top) - naturalTop - blockHeight)
      : 0;
    const keptBlockHeight = block.keepWithNext && nextBlock
      ? blockHeight + nextBlockGap + nextLeadingHeight
      : blockHeight;
    let logicalTop = naturalTop + insertedSpace;
    let pageIndex = Math.max(0, Math.floor(logicalTop / bodyHeight));
    let positionOnPage = logicalTop - pageIndex * bodyHeight;

    if (block.forcePageBreakBefore && positionOnPage > 0.5) {
      const pageRemainder = bodyHeight - positionOnPage;
      insertedSpace += pageRemainder;
      logicalTop += pageRemainder;
      pageIndex = Math.max(0, Math.floor((logicalTop + 0.5) / bodyHeight));
      positionOnPage = 0;
    }

    const lines = normalizeLines(block.lines, blockHeight);
    const splitAcrossPages = Boolean(
      block.splittable && !block.keepTogether && lines.length,
    );

    if (
      !splitAcrossPages
      && keptBlockHeight > 0
      && keptBlockHeight <= bodyHeight
      && positionOnPage > 0.5
      && positionOnPage + keptBlockHeight > bodyHeight + 0.5
    ) {
      const pageRemainder = bodyHeight - positionOnPage;
      insertedSpace += pageRemainder;
      logicalTop += pageRemainder;
      pageIndex = Math.max(0, Math.floor((logicalTop + 0.5) / bodyHeight));
    }

    const placement = {
      pageIndex,
      translateY: insertedSpace + pageIndex * chromeHeight - insertedInlineHeight,
    };

    if (splitAcrossPages) {
      let renderedPage = pageIndex;
      let blockInlineHeight = 0;

      lines.forEach((line, lineIndex) => {
        let logicalLineTop = naturalTop + line.top + insertedSpace;
        let linePage = Math.max(0, Math.floor((logicalLineTop + 0.5) / bodyHeight));
        let breakHeight = Math.max(0, linePage - renderedPage) * chromeHeight;
        renderedPage = Math.max(renderedPage, linePage);
        const linePosition = logicalLineTop - linePage * bodyHeight;
        const keepWithNextHeight = block.keepWithNext
          && lineIndex === lines.length - 1
          && nextBlock
          ? nextBlockGap + nextLeadingHeight
          : 0;
        const requiredHeight = line.height + keepWithNextHeight;

        if (
          requiredHeight > 0
          && requiredHeight <= bodyHeight
          && linePosition > 0.5
          && linePosition + requiredHeight > bodyHeight + 0.5
        ) {
          const pageRemainder = bodyHeight - linePosition;
          insertedSpace += pageRemainder;
          logicalLineTop += pageRemainder;
          linePage = Math.max(0, Math.floor((logicalLineTop + 0.5) / bodyHeight));
          breakHeight += pageRemainder
            + Math.max(1, linePage - renderedPage) * chromeHeight;
          renderedPage = Math.max(renderedPage + 1, linePage);
        }

        if (breakHeight > 0.5) {
          flowBreaks.push({
            pageIndex: linePage,
            blockIndex: index,
            textOffset: line.textOffset,
            height: breakHeight,
          });
          blockInlineHeight += breakHeight;
        }

        const logicalBottom = logicalLineTop + line.height;
        const occupiedPage = line.height > 0
          ? Math.max(
              linePage,
              Math.ceil(Math.max(0, logicalBottom - 0.5) / bodyHeight) - 1,
            )
          : linePage;
        lastOccupiedPage = Math.max(lastOccupiedPage, occupiedPage);
      });

      insertedInlineHeight += blockInlineHeight;
    } else {
      const logicalBottom = logicalTop + blockHeight;
      const occupiedPage = blockHeight > 0
        ? Math.max(pageIndex, Math.ceil(Math.max(0, logicalBottom - 0.5) / bodyHeight) - 1)
        : pageIndex;
      lastOccupiedPage = Math.max(lastOccupiedPage, occupiedPage);
    }

    placements.push(placement);
    if (retain) checkpoints.push({ insertedSpace, insertedInlineHeight, lastOccupiedPage, flowBreakCount: flowBreaks.length });
  }

  const layout = { pageCount: Math.max(1, lastOccupiedPage + 1), placements, flowBreaks };
  retain?.({ blocks, bodyHeight, chromeHeight, checkpoints, layout });
  return layout;
}

/** Variable-height page masters share the same measured-line/footnote model as
 * ordinary pages. Page styles never insert semantic breaks into the manuscript. */
function paginateStyledPages(
  blocks: readonly PublicationFlowBlock[],
  metrics: (index: number, sectionId?: string, insertedStyleId?: string) => PublicationPageMetrics,
  notes?: PublicationFootnotes,
  resume?: ComplexPaginationResume,
): PublicationPageLayout {
  const checkpoint = resume?.checkpoint;
  if (checkpoint?.metricsState) resume?.preparedMetrics?.restore(checkpoint.metricsState);
  const startBlock = checkpoint?.blockIndex ?? 0;
  const keepSections = resume ? firstKeepSectionIndexes(blocks) : undefined;
  const pageSectionIds = checkpoint?.pageSectionIds?.slice() ?? [];
  const pageNotes = checkpoint?.pageNotes.map(fragments => fragments.slice()) ?? [];
  const pageNoteHeights = checkpoint?.pageNoteHeights.slice() ?? [];
  const placements = checkpoint?.placements.slice() ?? [];
  const flowBreaks = checkpoint?.flowBreaks.slice() ?? [];
  const insertedPages = checkpoint?.insertedPages?.slice() ?? [];
  const movedSections = new Set(checkpoint?.movedSections);
  const seen = new Set(checkpoint?.seen);
  const lineHeight = positive(notes?.lineHeight ?? 1, 1), separator = nonNegative(notes?.separatorHeight ?? 0);
  const units = blocks.slice(startBlock).flatMap((block, localIndex) => {
    const blockIndex = startBlock + localIndex;
    const lines = normalizeLines(block.lines, block.height);
    const split = block.splittable && !block.keepTogether && lines.length;
    return (split ? lines : [{ top: 0, height: block.height, textOffset: 0, noteIds: block.noteIds }]).map((line, index, all) => ({
      blockIndex, sectionId: block.sectionId, textOffset: line.textOffset, top: nonNegative(block.top) + line.top,
      height: line.height, noteIds: line.noteIds ?? [], first: index === 0,
      forceBreak: index === 0 && block.forcePageBreakBefore, keepNext: index === all.length - 1 && block.keepWithNext,
      insertedPagesBefore: index === 0 ? block.insertedPagesBefore : undefined,
      insertedPagesAfter: index === all.length - 1 ? block.insertedPagesAfter : undefined,
      keepSectionId: block.keepSectionId ?? block.sectionId,
    }));
  });
  let page = checkpoint?.page ?? 0, position = checkpoint?.position ?? 0, naturalBottom = checkpoint?.naturalBottom ?? 0;
  let inlineHeight = checkpoint?.inlineHeight ?? 0, previousDelta = checkpoint?.previousDelta ?? 0;
  const ensurePage = (index: number, sectionId?: string) => {
    while (pageSectionIds.length <= index) pageSectionIds.push(sectionId);
  };
  const reservation = (index: number) => pageNotes[index]?.length
    ? separator + (pageNoteHeights[index] ?? 0) : 0;
  const capacity = (index: number) => Math.max(lineHeight, Math.floor((metrics(index, pageSectionIds[index]).bodyHeight * 0.55 - separator) / lineHeight) * lineHeight);
  for (let index = 0; index < units.length; index += 1) {
    const first = units[index]!;
    if (resume && first.first && first.blockIndex > startBlock && wantsComplexCheckpoint(resume, blocks, first.blockIndex, keepSections)) {
      retainComplexCheckpoint(resume, { blockIndex: first.blockIndex, page, position, naturalBottom, inlineHeight, previousDelta,
        pageNotes: pageNotes.map(fragments => fragments.slice()), pageNoteHeights: pageNoteHeights.slice(), seen: new Set(seen),
        placements: placements.slice(), flowBreaks: flowBreaks.slice(), pageSectionIds: pageSectionIds.slice(),
        insertedPages: insertedPages.slice(), movedSections: new Set(movedSections), metricsState: resume.preparedMetrics?.snapshot() });
    }
    ensurePage(page, first.sectionId);
    if (position <= 0.5 && !pageNotes[page]?.length) pageSectionIds[page] = first.sectionId;
    const advance = () => { page += 1; position = 0; ensurePage(page, first.sectionId); };
    if (first.insertedPagesBefore?.length) {
      if (position > 0.5) advance();
      while (reservation(page) > 0) advance();
      for (const insertion of first.insertedPagesBefore) {
        pageSectionIds[page] = undefined;
        insertedPages.push({ pageIndex: page, ...insertion });
        metrics(page, undefined, insertion.styleId ?? '');
        advance();
      }
    }
    const previousSectionId = index > 0 ? units[index - 1]?.sectionId : blocks[startBlock - 1]?.sectionId;
    const previousKeepSectionId = index > 0 ? units[index - 1]?.keepSectionId : blocks[startBlock - 1]?.keepSectionId ?? blocks[startBlock - 1]?.sectionId;
    const atBeginning = index === 0 && startBlock === 0;
    const sectionStart = first.sectionId !== undefined && (atBeginning || previousSectionId !== first.sectionId);
    const keepSection = (atBeginning || previousKeepSectionId !== first.keepSectionId) && blocks[first.blockIndex]!.keepSectionTogether;
    const group = [first];
    while (units[index + group.length] && !units[index + group.length]!.forceBreak && !units[index + group.length]!.insertedPagesBefore?.length
      && !group.at(-1)!.insertedPagesAfter?.length
      && ((keepSection && units[index + group.length]!.keepSectionId === first.keepSectionId) || group.at(-1)!.keepNext)) group.push(units[index + group.length]!);
    if (group.at(-1)!.top + group.at(-1)!.height - first.top > metrics(page, pageSectionIds[page]).bodyHeight) group.splice(1);
    const groupNotes = () => [...new Set(group.flatMap((unit) => [...unit.noteIds]))].filter((id) => !seen.has(id) && notes?.heights.has(id));
    let ids = groupNotes();
    let newNoteHeight = ids.reduce((sum, id) => sum + nonNegative(notes?.heights.get(id) ?? 0), 0);
    if (group.length > 1 && group.at(-1)!.top + group.at(-1)!.height - first.top + Math.min(capacity(page), newNoteHeight) + (newNoteHeight ? separator : 0) > metrics(page, pageSectionIds[page]).bodyHeight - 2) {
      group.splice(1);
      ids = groupNotes();
      newNoteHeight = ids.reduce((sum, id) => sum + nonNegative(notes?.heights.get(id) ?? 0), 0);
    }
    const last = group.at(-1)!, height = last.top + last.height - first.top;
    position += Math.max(0, first.top - naturalBottom);
    if (first.forceBreak && position > 0.5) advance();
    const reserved = () => newNoteHeight ? separator + Math.min(capacity(page), Math.max(0, reservation(page) - separator) + newNoteHeight) : reservation(page);
    if (position > 0.5 && position + height + reserved() > metrics(page, pageSectionIds[page]).bodyHeight - 2) {
      if (sectionStart && first.sectionId) movedSections.add(keepSection ? first.keepSectionId! : first.sectionId);
      advance();
    }
    // A continued footnote can occupy pages before the next reference fits.
    while (reservation(page) > 0 && (position + height + reserved() > metrics(page, pageSectionIds[page]).bodyHeight - 2
      || reservation(page) - separator + ids.length * lineHeight > capacity(page) + 0.5)) advance();
    // For a keep-together note style, move the reference to a sheet where
    // the entire new note group fits. Oversized notes still continue in
    // complete lines, to avoid truncating or silently dropping content.
    if (notes?.allowPageContinuation === false && newNoteHeight > 0) {
      while (reservation(page) > 0 && newNoteHeight <= capacity(page)
        && reservation(page) - separator + newNoteHeight > capacity(page) + 0.5) advance();
    }
    for (const [noteIndex, id] of ids.entries()) {
      seen.add(id);
      let remaining = nonNegative(notes?.heights.get(id) ?? 0), offset = 0, notePage = page;
      while (remaining > 0.01) {
        ensurePage(notePage, first.sectionId);
        const fragments = pageNotes[notePage] ??= [];
        const used = pageNoteHeights[notePage] ?? 0;
        const following = notePage === page ? (ids.length - noteIndex - 1) * lineHeight : 0;
        const slice = Math.min(remaining, Math.max(0, capacity(notePage) - used - following));
        if (slice > 0.01) { fragments.push({ id, offset, height: slice }); pageNoteHeights[notePage] = used + slice; offset += slice; remaining -= slice; }
        notePage += 1;
      }
    }
    for (const unit of group) {
      const actualTop = metrics(page, pageSectionIds[page]).bodyTop + position + unit.top - first.top;
      const delta = actualTop - unit.top;
      if (unit.first) placements[unit.blockIndex] = { pageIndex: page, translateY: delta - inlineHeight };
      else if (delta > previousDelta + 0.5) {
        const height = delta - previousDelta; flowBreaks.push({ pageIndex: page, blockIndex: unit.blockIndex, textOffset: unit.textOffset, height }); inlineHeight += height;
      }
      previousDelta = delta;
    }
    position += height; naturalBottom = last.top + last.height; index += group.length - 1;
    if (last.insertedPagesAfter?.length) {
      if (position > 0.5) advance();
      while (reservation(page) > 0) advance();
      for (const insertion of last.insertedPagesAfter) {
        pageSectionIds[page] = undefined;
        insertedPages.push({ pageIndex: page, ...insertion });
        metrics(page, undefined, insertion.styleId ?? '');
        advance();
      }
    }
  }
  ensurePage(0);
  const pageCount = [...placements, ...flowBreaks, ...insertedPages].reduce((count, item) => Math.max(count, item.pageIndex + 1), Math.max(1, pageNotes.length));
  const result = { pageCount, placements, flowBreaks, pageNotes, pageSectionIds, insertedPages };
  return { ...result, sectionWarnings: publicationSectionFitWarnings(blocks, result, (index) => metrics(index, pageSectionIds[index]), movedSections) };
}

export function publicationSectionFitWarnings(blocks: readonly PublicationFlowBlock[], layout: PublicationPageLayout,
  metrics?: (index: number) => PublicationPageMetrics, movedSections: ReadonlySet<string> = new Set()) {
  const { placements, flowBreaks } = layout;
  const lastBreakPages = new Map<number, number>();
  for (const point of flowBreaks) lastBreakPages.set(point.blockIndex, Math.max(lastBreakPages.get(point.blockIndex) ?? 0, point.pageIndex));
  const ranges = new Map<string, { firstPage: number; lastPage: number; height: number; keep: boolean }>();
  blocks.forEach((block, blockIndex) => {
    const placement = placements[blockIndex];
    if (!block.sectionId || !placement) return;
    const lastPage = Math.max(placement.pageIndex, lastBreakPages.get(blockIndex) ?? 0);
    for (const id of new Set([block.sectionId, ...(block.keepSectionId ? [block.keepSectionId] : [])])) {
      const prior = ranges.get(id);
      ranges.set(id, { firstPage: Math.min(prior?.firstPage ?? placement.pageIndex, placement.pageIndex),
        lastPage: Math.max(prior?.lastPage ?? lastPage, lastPage), height: (prior?.height ?? 0) + block.height,
        keep: (prior?.keep ?? false) || !!block.keepSectionTogether });
    }
  });
  const sectionWarnings: NonNullable<PublicationPageLayout['sectionWarnings']> = [];
  for (const [sectionId, range] of ranges) {
    if (range.lastPage > range.firstPage) sectionWarnings.push({ sectionId, firstPage: range.firstPage, lastPage: range.lastPage,
      reason: range.keep && metrics && range.height > metrics(range.firstPage).bodyHeight ? 'oversized' : 'continued' });
    else if (movedSections.has(sectionId)) sectionWarnings.push({ sectionId, firstPage: range.firstPage, lastPage: range.lastPage, reason: 'moved' });
  }
  return sectionWarnings;
}


/**
 * A DOM Range is a glyph/run box, not a typographic line box. Different
 * inline fonts and superscripts can return several rectangles for one line.
 * Page spacers must only be inserted between complete, safe lines.
 */
export function coalescePublicationTextLines(
  fragments: readonly PublicationFlowLine[],
  text: string,
  lineHeight: number,
): PublicationFlowLine[] {
  const leading = positive(lineHeight, 1);
  const clusters: { center: number; top: number; bottom: number; offset: number }[] = [];
  for (const fragment of [...fragments].sort((a, b) => (a.top + a.height / 2) - (b.top + b.height / 2))) {
    const center = fragment.top + fragment.height / 2;
    const previous = clusters.at(-1);
    if (previous && Math.abs(center - previous.center) <= leading * 0.45) {
      previous.top = Math.min(previous.top, fragment.top);
      previous.bottom = Math.max(previous.bottom, fragment.top + fragment.height);
      previous.offset = Math.min(previous.offset, fragment.textOffset);
    } else {
      clusters.push({ center, top: fragment.top, bottom: fragment.top + fragment.height, offset: fragment.textOffset });
    }
  }
  const result: PublicationFlowLine[] = [];
  const wordCharacter = /[\p{L}\p{M}\p{N}]/u;
  for (const cluster of clusters) {
    const top = Math.max(0, Math.min(cluster.top, cluster.center - leading / 2));
    const bottom = Math.max(cluster.bottom, cluster.center + leading / 2, top + leading);
    const previous = result.at(-1);
    const before = text.slice(0, cluster.offset).match(/.$/su)?.[0] ?? '';
    const after = text.slice(cluster.offset).match(/^./su)?.[0] ?? '';
    // Inserting a block widget at an automatic/soft hyphen can make the
    // browser lose that hyphen. Keep both visual lines on the same sheet.
    // Literal visible hyphens remain legal breakpoints.
    const insideWord = (wordCharacter.test(before) || before === '\u00ad') && wordCharacter.test(after);
    if (previous && (insideWord || cluster.offset <= previous.textOffset)) {
      previous.height = Math.max(previous.top + previous.height, bottom) - previous.top;
    } else {
      result.push({ textOffset: cluster.offset, top, height: bottom - top });
    }
  }
  return result;
}

function normalizeLines(
  lines: readonly PublicationFlowLine[] | undefined,
  blockHeight: number,
): PublicationFlowLine[] {
  if (!lines?.length) return [];
  return lines
    .map((line) => ({
      noteIds: line.noteIds,
      textOffset: Math.max(0, Math.trunc(nonNegative(line.textOffset))),
      top: Math.min(blockHeight, nonNegative(line.top)),
      height: nonNegative(line.height),
    }))
    .filter((line) => line.height > 0)
    .sort((left, right) => left.top - right.top || left.textOffset - right.textOffset)
    .filter((line, index, values) => (
      index === 0
      || Math.abs(line.top - values[index - 1]!.top) > 0.5
    ));
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}


export interface PublicationPageNote {
  id: string;
  offset: number;
  height: number;
}

export interface PublicationFootnotes {
  heights: ReadonlyMap<string, number>;
  lineHeight: number;
  separatorHeight: number;
  /** Defaults to true for backwards-compatible, line-by-line continuation. */
  allowPageContinuation?: boolean;
}

/** Reserve footnote space while placing each reference line, before committing
 * the page. Long notes continue on subsequent sheets in whole measured lines.
 * The manuscript and its semantic note numbering remain untouched.
 */
function paginateWithFootnotes(
  blocks: readonly PublicationFlowBlock[],
  usablePageHeight: number,
  pageOverhead: number,
  notes: PublicationFootnotes,
  resume?: ComplexPaginationResume,
): PublicationPageLayout {
  const checkpoint = resume?.checkpoint;
  const startBlock = checkpoint?.blockIndex ?? 0;
  const bodyHeight = positive(usablePageHeight, 1);
  const stride = bodyHeight + nonNegative(pageOverhead);
  // offsetTop is integer-rounded while DOM ranges and CSS spacers are fractional.
  // Keep that rounding from putting the final glyph against the footnote rule.
  const bodyLimit = Math.max(1, bodyHeight - 2);
  const lineHeight = positive(notes.lineHeight, 1);
  const separator = nonNegative(notes.separatorHeight);
  const noteCapacity = Math.max(lineHeight, Math.floor((bodyHeight * 0.55 - separator) / lineHeight) * lineHeight);
  const pageNotes = checkpoint?.pageNotes.map(fragments => fragments.slice()) ?? [];
  const pageNoteHeights = checkpoint?.pageNoteHeights.slice() ?? [];
  const seen = new Set(checkpoint?.seen);
  const placements = checkpoint?.placements.slice() ?? [];
  const flowBreaks = checkpoint?.flowBreaks.slice() ?? [];
  const units = blocks.slice(startBlock).flatMap((block, localIndex) => {
    const blockIndex = startBlock + localIndex;
    const lines = normalizeLines(block.lines, block.height);
    const split = block.splittable && !block.keepTogether && lines.length;
    return (split ? lines : [{ top: 0, height: block.height, textOffset: 0, noteIds: block.noteIds }]).map((line, index, all) => ({
      blockIndex,
      textOffset: line.textOffset,
      top: nonNegative(block.top) + line.top,
      height: line.height,
      noteIds: line.noteIds ?? [],
      first: index === 0,
      forceBreak: index === 0 && block.forcePageBreakBefore,
      keepNext: index === all.length - 1 && block.keepWithNext,
    }));
  });
  const reserved = (page: number) => pageNotes[page]?.length
    ? separator + (pageNoteHeights[page] ?? 0) : 0;
  let page = checkpoint?.page ?? 0;
  let position = checkpoint?.position ?? 0;
  let naturalBottom = checkpoint?.naturalBottom ?? 0;
  let inlineHeight = checkpoint?.inlineHeight ?? 0;
  let previousDelta = checkpoint?.previousDelta ?? 0;

  for (let index = 0; index < units.length; index += 1) {
    const first = units[index]!;
    if (resume && first.first && first.blockIndex > startBlock && wantsComplexCheckpoint(resume, blocks, first.blockIndex)) {
      retainComplexCheckpoint(resume, { blockIndex: first.blockIndex, page, position, naturalBottom, inlineHeight, previousDelta,
        pageNotes: pageNotes.map(fragments => fragments.slice()), pageNoteHeights: pageNoteHeights.slice(), seen: new Set(seen),
        placements: placements.slice(), flowBreaks: flowBreaks.slice() });
    }
    const group = [first];
    while (group[group.length - 1]!.keepNext && units[index + group.length]) {
      group.push(units[index + group.length]!);
    }
    // Impossible keep chains must not force ordinary text outside a sheet.
    if (group[group.length - 1]!.top + group[group.length - 1]!.height - first.top > bodyHeight) {
      group.splice(1);
    }
    const last = group[group.length - 1]!;
    const height = last.top + last.height - first.top;
    const ids = [...new Set(group.flatMap((unit) => [...unit.noteIds]))]
      .filter((id) => !seen.has(id) && notes.heights.has(id));
    const newNoteHeight = ids.reduce((sum, id) => sum + nonNegative(notes.heights.get(id) ?? 0), 0);
    position += Math.max(0, first.top - naturalBottom);
    if (first.forceBreak && position > 0.5) {
      page += 1;
      position = 0;
    }
    const requiredReservation = () => {
      const existing = reserved(page);
      return newNoteHeight ? separator + Math.min(noteCapacity, Math.max(0, existing - separator) + newNoteHeight) : existing;
    };
    if (position > 0.5 && position + height + requiredReservation() > bodyLimit) {
      page += 1;
      position = 0;
    }
    // A carried note may fill much of the next sheet. Advance until this unit fits.
    while (reserved(page) > 0 && (position + height + requiredReservation() > bodyLimit
      || reserved(page) - separator + ids.length * lineHeight > noteCapacity + 0.5)) {
      page += 1;
      position = 0;
    }
    // Preserve whole footnotes when they fit on an otherwise available sheet.
    // A note larger than a sheet's note area still has to continue.
    if (notes.allowPageContinuation === false && newNoteHeight > 0 && newNoteHeight <= noteCapacity) {
      while (reserved(page) > 0 && reserved(page) - separator + newNoteHeight > noteCapacity + 0.5) {
        page += 1;
        position = 0;
      }
    }
    for (const [noteIndex, id] of ids.entries()) {
      seen.add(id);
      let remaining = nonNegative(notes.heights.get(id) ?? 0);
      let offset = 0;
      let notePage = page;
      while (remaining > 0.01) {
        const fragments = pageNotes[notePage] ??= [];
        const used = pageNoteHeights[notePage] ?? 0;
        // Leave at least one line for every other reference introduced here.
        const followingStarts = notePage === page ? (ids.length - noteIndex - 1) * lineHeight : 0;
        const available = Math.max(0, noteCapacity - used - followingStarts);
        const slice = Math.min(remaining, available);
        if (slice > 0.01) {
          fragments.push({ id, offset, height: slice });
          pageNoteHeights[notePage] = used + slice;
          offset += slice;
          remaining -= slice;
        }
        notePage += 1;
      }
    }
    for (const unit of group) {
      const actualTop = page * stride + position + unit.top - first.top;
      const delta = actualTop - unit.top;
      if (unit.first) {
        placements[unit.blockIndex] = { pageIndex: page, translateY: delta - inlineHeight };
      } else if (delta > previousDelta + 0.5) {
        const height = delta - previousDelta;
        flowBreaks.push({ pageIndex: page, blockIndex: unit.blockIndex, textOffset: unit.textOffset, height });
        inlineHeight += height;
      }
      previousDelta = delta;
    }
    position += height;
    naturalBottom = last.top + last.height;
    index += group.length - 1;
  }
  return { pageCount: Math.max(1, page + 1, pageNotes.length), placements, flowBreaks, pageNotes };
}
