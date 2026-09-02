/** Finds the rendered heading (or first block fallback) for an OMI section. */
export function findRenderedSectionElement(
  sectionId: string,
): HTMLElement | null {
  return document.getElementById(`omi-target-${sectionId}`)
    ?? document.querySelector<HTMLElement>(
      `[data-section-id="${cssEscape(sectionId)}"]`,
    );
}

/** Returns one observable DOM target for each section, in model order. */
export function findRenderedSectionElements(
  sectionIds: readonly string[],
): HTMLElement[] {
  const seen = new Set<HTMLElement>();
  const elements: HTMLElement[] = [];

  for (const sectionId of sectionIds) {
    const element = findRenderedSectionElement(sectionId);
    if (!element || seen.has(element)) continue;
    seen.add(element);
    elements.push(element);
  }

  return elements;
}

/** Returns all top-level editor nodes that belong to one semantic section. */
export function findRenderedSectionContentElements(
  sectionId: string,
): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(
      `.omi-continuous-tiptap-editor > [data-section-id="${cssEscape(sectionId)}"]`,
    ),
  );
}

/** Finds a block in any of the independently mounted study editors. */
export function findRenderedBlockElement(blockId: string): HTMLElement | null {
  return document.getElementById(`omi-target-${blockId}`)
    ?? document.querySelector<HTMLElement>(
      `[data-block-id="${cssEscape(blockId)}"]`,
    );
}

function cssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/g, '\\$&');
}
