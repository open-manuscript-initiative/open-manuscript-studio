export interface PublicationFlowBlock {
  top: number;
  height: number;
  keepWithNext?: boolean;
}

export interface PublicationBlockPlacement {
  pageIndex: number;
  translateY: number;
}

export interface PublicationPageLayout {
  pageCount: number;
  placements: PublicationBlockPlacement[];
}

/**
 * Maps the editor's continuous block flow onto screen pages.
 *
 * Pagination is deliberately presentation-only: no page breaks or cached page
 * numbers are written into the OMI document. Blocks that fit on one page are
 * moved intact to the next page when necessary, while unusually tall blocks
 * are allowed to flow instead of creating an endless sequence of breaks.
 */
export function paginatePublicationBlocks(
  blocks: readonly PublicationFlowBlock[],
  usablePageHeight: number,
  pageOverhead: number,
): PublicationPageLayout {
  const bodyHeight = positive(usablePageHeight, 1);
  const chromeHeight = nonNegative(pageOverhead);
  let insertedSpace = 0;
  let lastOccupiedPage = 0;

  const placements = blocks.map((block, index) => {
    const naturalTop = nonNegative(block.top);
    const blockHeight = nonNegative(block.height);
    const nextBlock = blocks[index + 1];
    const nextBlockHeight = nonNegative(nextBlock?.height ?? 0);
    const nextBlockGap = nextBlock
      ? Math.max(0, nonNegative(nextBlock.top) - naturalTop - blockHeight)
      : 0;
    const keptBlockHeight = block.keepWithNext && nextBlock
      ? blockHeight + nextBlockGap + nextBlockHeight
      : blockHeight;
    let logicalTop = naturalTop + insertedSpace;
    let pageIndex = Math.max(0, Math.floor(logicalTop / bodyHeight));
    const positionOnPage = logicalTop - pageIndex * bodyHeight;

    if (
      keptBlockHeight > 0
      && keptBlockHeight <= bodyHeight
      && positionOnPage > 0.5
      && positionOnPage + keptBlockHeight > bodyHeight + 0.5
    ) {
      const pageRemainder = bodyHeight - positionOnPage;
      insertedSpace += pageRemainder;
      logicalTop += pageRemainder;
      pageIndex = Math.max(0, Math.floor((logicalTop + 0.5) / bodyHeight));
    }

    const logicalBottom = logicalTop + blockHeight;
    const occupiedPage = blockHeight > 0
      ? Math.max(pageIndex, Math.ceil(Math.max(0, logicalBottom - 0.5) / bodyHeight) - 1)
      : pageIndex;
    lastOccupiedPage = Math.max(lastOccupiedPage, occupiedPage);

    return {
      pageIndex,
      translateY: insertedSpace + pageIndex * chromeHeight,
    };
  });

  return {
    pageCount: Math.max(1, lastOccupiedPage + 1),
    placements,
  };
}

function positive(value: number, fallback: number): number {
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value >= 0 ? value : 0;
}
