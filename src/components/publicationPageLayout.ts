export interface PublicationFlowBlock {
  top: number;
  height: number;
  lines?: readonly PublicationFlowLine[];
  leadingHeight?: number;
  splittable?: boolean;
  keepWithNext?: boolean;
  keepTogether?: boolean;
  forcePageBreakBefore?: boolean;
}

export interface PublicationFlowLine {
  textOffset: number;
  top: number;
  height: number;
}

export interface PublicationFlowBreak {
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
): PublicationPageLayout {
  const bodyHeight = positive(usablePageHeight, 1);
  const chromeHeight = nonNegative(pageOverhead);
  let insertedSpace = 0;
  let insertedInlineHeight = 0;
  let lastOccupiedPage = 0;
  const flowBreaks: PublicationFlowBreak[] = [];

  const placements = blocks.map((block, index) => {
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
        let linePosition = logicalLineTop - linePage * bodyHeight;
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
          linePosition = 0;
        }

        if (breakHeight > 0.5) {
          flowBreaks.push({
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

    return placement;
  });

  return {
    pageCount: Math.max(1, lastOccupiedPage + 1),
    placements,
    flowBreaks,
  };
}

function normalizeLines(
  lines: readonly PublicationFlowLine[] | undefined,
  blockHeight: number,
): PublicationFlowLine[] {
  if (!lines?.length) return [];
  return lines
    .map((line) => ({
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
