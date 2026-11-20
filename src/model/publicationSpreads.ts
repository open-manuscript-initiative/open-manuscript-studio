/** Facing pages always start with a recto (odd, right-hand) page. */
export function publicationFirstPageNumber(page: { pageNumberStart?: number; facingPages?: boolean }): number {
  const value = Number.isFinite(page.pageNumberStart) ? Math.max(0, Math.trunc(page.pageNumberStart!)) : 1;
  return page.facingPages ? Math.max(1, value + (value % 2 === 0 ? 1 : 0)) : value;
}

export interface PublicationSheetSize { width: number; height: number }
export interface PublicationSheetPosition {
  x: number;
  top: number;
  /** Pagination stays in a continuous vertical coordinate space. */
  flowTop: number;
  side: 'left' | 'right';
  spread: number;
}

/** The missing first verso is pasteboard, never an inserted manuscript page.
 * Variable-sized masters align at the spine and use the taller sheet per row. */
export function arrangePublicationSheets(sizes: readonly PublicationSheetSize[], facingPages: boolean, gap: number) {
  const spine = Math.max(0, ...sizes.map((page) => page.width));
  const pages: PublicationSheetPosition[] = [];
  let flowTop = 0, top = 0;
  for (let index = 0; index < sizes.length; index += 1) {
    const size = sizes[index]!;
    const right = index % 2 === 0;
    pages.push({ x: facingPages ? (right ? spine : spine - size.width) : 0,
      top: facingPages ? top : flowTop, flowTop, side: right ? 'right' : 'left',
      spread: facingPages ? Math.ceil(index / 2) : index });
    flowTop += size.height + gap;
    if (facingPages && (right || index === sizes.length - 1)) {
      top += Math.max(size.height, right && index > 0 ? sizes[index - 1]!.height : 0) + gap;
    }
  }
  return { pages, width: spine * (facingPages ? 2 : 1),
    height: Math.max(0, (facingPages ? top : flowTop) - (sizes.length ? gap : 0)) };
}
