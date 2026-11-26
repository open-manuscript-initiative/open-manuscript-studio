import type { PublicationPageInsertion, PublicationPageStyleCollection } from './publicationPageStyles';
/** Spreadsheet-style letters are independent of physical page order. */
export function publicationPageStyleLetter(index: number): string {
  if (!Number.isSafeInteger(index) || index < 0) throw new Error('Invalid page style index.');
  let letter = '', value = index + 1;
  while (value > 0) { value -= 1; letter = String.fromCharCode(65 + value % 26) + letter; value = Math.floor(value / 26); }
  return letter;
}
export interface PublicationPageThumbnail {
  id: string; number: number; styleId: string; width: number; height: number;
  label?: string; background?: string;
  marks: { x: number; y: number; width: number; height: number; graphic?: boolean; rotation?: number }[];
  moveUpTarget?: number; moveDownTarget?: number;
  canDelete?: boolean; canInsert?: boolean; canMoveUp?: boolean; canMoveDown?: boolean;
}

export interface PublicationBodyPageThumbnail extends PublicationPageThumbnail {
  firstBlockId?: string; lastBlockId?: string; studyId?: string; insertionId?: string;
}
/** Blank pages at the same boundary keep an explicit order. */
export function placePublicationEmptyPage(collection: PublicationPageStyleCollection, page: PublicationPageInsertion,
  target: PublicationBodyPageThumbnail, side: 'before' | 'after'): PublicationPageStyleCollection {
  const items = (collection.insertions ?? []).filter((item) => item.id !== page.id);
  const targetIndex = items.findIndex((item) => item.id === target.insertionId);
  if (targetIndex >= 0) {
    const anchor = items[targetIndex]!;
    items.splice(targetIndex + (side === 'after' ? 1 : 0), 0, { id: page.id, styleId: page.styleId,
      ...(anchor.beforeBlockId ? { beforeBlockId: anchor.beforeBlockId } : { afterBlockId: anchor.afterBlockId }) });
  } else {
    const anchor = side === 'before' ? target.firstBlockId : target.lastBlockId;
    if (!anchor) return collection;
    items.push({ id: page.id, styleId: page.styleId, ...(side === 'before' ? { beforeBlockId: anchor } : { afterBlockId: anchor }) });
  }
  return { ...collection, insertions: items };
}

/** Index the nearest valid block at or after each flow position in one pass. */
export function publicationFlowAnchors(ids: readonly (string | undefined)[], valid: ReadonlySet<string>): (string | undefined)[] {
  const anchors: (string | undefined)[] = new Array(ids.length);
  let next: string | undefined;
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    const id = ids[index];
    if (id && valid.has(id)) next = id;
    anchors[index] = next;
  }
  return anchors;
}

/** Fill note-only sheet boundaries with the next real anchor, or prior end. */
export function fillPublicationThumbnailBoundaries(pages: PublicationBodyPageThumbnail[]): void {
  const following: (string | undefined)[] = new Array(pages.length);
  let next: string | undefined;
  for (let index = pages.length - 1; index >= 0; index -= 1) {
    following[index] = next;
    next = pages[index]!.firstBlockId ?? next;
  }
  let previous: string | undefined;
  for (const [index, page] of pages.entries()) {
    page.firstBlockId ??= following[index] ?? previous;
    page.lastBlockId ??= page.firstBlockId;
    previous = page.lastBlockId ?? previous;
  }
}
