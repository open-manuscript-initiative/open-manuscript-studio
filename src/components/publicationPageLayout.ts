export interface PublicationFlowBlock {
  top: number;
  height: number;
  noteIds?: readonly string[];
  lines?: readonly PublicationFlowLine[];
  leadingHeight?: number;
  splittable?: boolean;
  keepWithNext?: boolean;
  keepTogether?: boolean;
  forcePageBreakBefore?: boolean;
}

export interface PublicationFlowLine {
  noteIds?: readonly string[];
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
  pageNotes?: PublicationPageNote[][];
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
): PublicationPageLayout {
  if (footnotes && blocks.some((block) => block.noteIds?.length || block.lines?.some((line) => line.noteIds?.length))) {
    return paginateWithFootnotes(blocks, usablePageHeight, pageOverhead, footnotes);
  }
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
): PublicationPageLayout {
  const bodyHeight = positive(usablePageHeight, 1);
  const stride = bodyHeight + nonNegative(pageOverhead);
  // offsetTop is integer-rounded while DOM ranges and CSS spacers are fractional.
  // Keep that rounding from putting the final glyph against the footnote rule.
  const bodyLimit = Math.max(1, bodyHeight - 2);
  const lineHeight = positive(notes.lineHeight, 1);
  const separator = nonNegative(notes.separatorHeight);
  const noteCapacity = Math.max(lineHeight, Math.floor((bodyHeight * 0.55 - separator) / lineHeight) * lineHeight);
  const pageNotes: PublicationPageNote[][] = [];
  const seen = new Set<string>();
  const placements: PublicationBlockPlacement[] = [];
  const flowBreaks: PublicationFlowBreak[] = [];
  const units = blocks.flatMap((block, blockIndex) => {
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
  const reserved = (page: number) => {
    const fragments = pageNotes[page] ?? [];
    return fragments.length ? separator + fragments.reduce((sum, fragment) => sum + fragment.height, 0) : 0;
  };
  let page = 0;
  let position = 0;
  let naturalBottom = 0;
  let inlineHeight = 0;
  let previousDelta = 0;

  for (let index = 0; index < units.length; index += 1) {
    const first = units[index]!;
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
    for (const [noteIndex, id] of ids.entries()) {
      seen.add(id);
      let remaining = nonNegative(notes.heights.get(id) ?? 0);
      let offset = 0;
      let notePage = page;
      while (remaining > 0.01) {
        const fragments = pageNotes[notePage] ??= [];
        const used = fragments.reduce((sum, fragment) => sum + fragment.height, 0);
        // Leave at least one line for every other reference introduced here.
        const followingStarts = notePage === page ? (ids.length - noteIndex - 1) * lineHeight : 0;
        const available = Math.max(0, noteCapacity - used - followingStarts);
        const slice = Math.min(remaining, available);
        if (slice > 0.01) {
          fragments.push({ id, offset, height: slice });
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
        flowBreaks.push({ blockIndex: unit.blockIndex, textOffset: unit.textOffset, height });
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
