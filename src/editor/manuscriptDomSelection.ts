import { getManuscriptBlockOrder } from '../model/manuscriptEditingOrder';
import type { OmiSection } from '../types/omi';
import { getStoredTextLength } from './manuscriptClipboard';

export interface ManuscriptSelectionPoint {
  blockId: string;
  offset: number;
}

export interface ManuscriptSelectionRange {
  start: ManuscriptSelectionPoint;
  end: ManuscriptSelectionPoint;
}

export interface ManuscriptSelectionSegment {
  blockId: string;
  from: number;
  to: number;
}

interface RenderedManuscriptSelection {
  root: HTMLElement;
  range: ManuscriptSelectionRange;
}

interface HighlightRegistry {
  set: (name: string, highlight: unknown) => void;
  delete: (name: string) => boolean;
}

const MANUSCRIPT_SELECTION_HIGHLIGHT = 'omi-manuscript-selection';
let renderedSelection: RenderedManuscriptSelection | null = null;

export function normalizeManuscriptSelectionRange(
  sections: readonly OmiSection[],
  anchor: ManuscriptSelectionPoint,
  focus: ManuscriptSelectionPoint,
): ManuscriptSelectionRange | null {
  const order = getManuscriptBlockOrder(sections);
  const anchorIndex = order.findIndex(({ block }) => block.id === anchor.blockId);
  const focusIndex = order.findIndex(({ block }) => block.id === focus.blockId);
  if (anchorIndex < 0 || focusIndex < 0) return null;

  if (anchorIndex < focusIndex) return { start: anchor, end: focus };
  if (anchorIndex > focusIndex) return { start: focus, end: anchor };
  return anchor.offset <= focus.offset
    ? { start: anchor, end: focus }
    : { start: focus, end: anchor };
}

export function readManuscriptDomSelection(
  root: HTMLElement,
  sections: readonly OmiSection[],
): ManuscriptSelectionRange | null {
  const selection = window.getSelection();
  const fallback = getRenderedManuscriptSelection(root);
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return fallback;

  const anchorEditor = findBlockEditor(selection.anchorNode, root);
  const focusEditor = findBlockEditor(selection.focusNode, root);
  if (!anchorEditor || !focusEditor) return fallback;

  const anchorBlockId = anchorEditor.dataset.blockId;
  const focusBlockId = focusEditor.dataset.blockId;
  if (!anchorBlockId || !focusBlockId) return fallback;

  const anchorOffset = domPointToTextOffset(
    anchorEditor,
    selection.anchorNode,
    selection.anchorOffset,
  );
  const focusOffset = domPointToTextOffset(
    focusEditor,
    selection.focusNode,
    selection.focusOffset,
  );

  const anchor = { blockId: anchorBlockId, offset: anchorOffset };
  const focus = { blockId: focusBlockId, offset: focusOffset };
  const nativeRange = normalizeManuscriptSelectionRange(sections, anchor, focus);
  if (
    fallback &&
    fallback.start.blockId !== fallback.end.blockId &&
    nativeRange?.start.blockId === nativeRange?.end.blockId
  ) {
    // Chromium/WebKit may clamp a DOM Selection to one contenteditable host.
    // Preserve the manuscript-level range that the pointer controller rendered
    // across the independent paragraph editors.
    return fallback;
  }
  return nativeRange ?? fallback;
}

export function getManuscriptSelectionSegments(
  sections: readonly OmiSection[],
  range: ManuscriptSelectionRange,
): ManuscriptSelectionSegment[] {
  const order = getManuscriptBlockOrder(sections).filter(({ block }) => !block.visual);
  const startIndex = order.findIndex(({ block }) => block.id === range.start.blockId);
  const endIndex = order.findIndex(({ block }) => block.id === range.end.blockId);
  if (startIndex < 0 || endIndex < startIndex) return [];

  return order.slice(startIndex, endIndex + 1).map(({ block }, index, selected) => {
    const length = getStoredTextLength(block.content);
    const from = index === 0 ? clamp(range.start.offset, 0, length) : 0;
    const to = index === selected.length - 1
      ? clamp(range.end.offset, from, length)
      : length;
    return { blockId: block.id, from, to };
  });
}

export function getEntireManuscriptSelection(
  sections: readonly OmiSection[],
): ManuscriptSelectionRange | null {
  const textBlocks = getManuscriptBlockOrder(sections).filter(({ block }) => !block.visual);
  const first = textBlocks[0]?.block;
  const last = textBlocks[textBlocks.length - 1]?.block;
  if (!first || !last) return null;
  return {
    start: { blockId: first.id, offset: 0 },
    end: { blockId: last.id, offset: getStoredTextLength(last.content) },
  };
}

export function renderManuscriptDomSelection(
  root: HTMLElement,
  sections: readonly OmiSection[],
  range: ManuscriptSelectionRange,
): void {
  const editors = Array.from(
    root.querySelectorAll<HTMLElement>('.omi-tiptap-editor[data-block-id]'),
  );
  if (editors.length === 0) return;

  const startEditor = editors.find((editor) => editor.dataset.blockId === range.start.blockId)
    ?? editors[0];
  const endEditor = editors.find((editor) => editor.dataset.blockId === range.end.blockId)
    ?? editors[editors.length - 1];
  if (!startEditor || !endEditor) return;

  const domRange = document.createRange();
  const startOffset = startEditor.dataset.blockId === range.start.blockId
    ? range.start.offset
    : 0;
  const endOffset = endEditor.dataset.blockId === range.end.blockId
    ? range.end.offset
    : Number.MAX_SAFE_INTEGER;
  const startPoint = textOffsetToDomPoint(startEditor, startOffset);
  const endPoint = textOffsetToDomPoint(endEditor, endOffset);
  if (!startPoint || !endPoint) return;

  domRange.setStart(startPoint.node, startPoint.offset);
  domRange.setEnd(endPoint.node, endPoint.offset);
  renderedSelection = { root, range: cloneSelectionRange(range) };
  renderSelectionHighlight(root, sections, range);

  const selection = window.getSelection();
  if (!selection) return;
  try {
    selection.removeAllRanges();
    selection.addRange(domRange);
  } catch {
    // Some editing hosts reject a native range that crosses contenteditable
    // roots. The CSS Highlight and stored manuscript range remain authoritative.
  }
}

export function getRenderedManuscriptSelection(
  root?: HTMLElement,
): ManuscriptSelectionRange | null {
  if (!renderedSelection || (root && renderedSelection.root !== root)) return null;
  return cloneSelectionRange(renderedSelection.range);
}

export function getRenderedManuscriptSelectionRoot(): HTMLElement | null {
  return renderedSelection?.root ?? null;
}

export function clearRenderedManuscriptSelection(root?: HTMLElement): void {
  if (root && renderedSelection?.root !== root) return;
  renderedSelection = null;
  getHighlightRegistry()?.delete(MANUSCRIPT_SELECTION_HIGHLIGHT);
}

export function createManuscriptDomRange(
  root: HTMLElement,
  range: ManuscriptSelectionRange,
): Range | null {
  const startEditor = root.querySelector<HTMLElement>(
    `.omi-tiptap-editor[data-block-id="${escapeAttributeValue(range.start.blockId)}"]`,
  );
  const endEditor = root.querySelector<HTMLElement>(
    `.omi-tiptap-editor[data-block-id="${escapeAttributeValue(range.end.blockId)}"]`,
  );
  if (!startEditor || !endEditor) return null;

  const startPoint = textOffsetToDomPoint(startEditor, range.start.offset);
  const endPoint = textOffsetToDomPoint(endEditor, range.end.offset);
  if (!startPoint || !endPoint) return null;

  const domRange = document.createRange();
  try {
    domRange.setStart(startPoint.node, startPoint.offset);
    domRange.setEnd(endPoint.node, endPoint.offset);
  } catch {
    return null;
  }
  return domRange;
}

export function decorateManuscriptSelection(
  root: HTMLElement,
  sections: readonly OmiSection[],
  range: ManuscriptSelectionRange | null,
): void {
  const selected = new Set<string>();
  if (range) {
    const order = getManuscriptBlockOrder(sections);
    const startIndex = order.findIndex(({ block }) => block.id === range.start.blockId);
    const endIndex = order.findIndex(({ block }) => block.id === range.end.blockId);
    if (startIndex >= 0 && endIndex >= startIndex) {
      order.slice(startIndex, endIndex + 1).forEach(({ block }) => selected.add(block.id));
    }
  }

  root.querySelectorAll<HTMLElement>('[data-block-id]').forEach((element) => {
    const blockId = element.dataset.blockId;
    element.toggleAttribute('data-manuscript-selected', Boolean(blockId && selected.has(blockId)));
  });
}

function renderSelectionHighlight(
  root: HTMLElement,
  sections: readonly OmiSection[],
  range: ManuscriptSelectionRange,
): void {
  const registry = getHighlightRegistry();
  const HighlightConstructor = getHighlightConstructor();
  if (!registry || !HighlightConstructor) return;

  const ranges = getManuscriptSelectionSegments(sections, range).flatMap((segment) => {
    const editor = root.querySelector<HTMLElement>(
      `.omi-tiptap-editor[data-block-id="${escapeAttributeValue(segment.blockId)}"]`,
    );
    if (!editor) return [];
    const start = textOffsetToDomPoint(editor, segment.from);
    const end = textOffsetToDomPoint(editor, segment.to);
    if (!start || !end) return [];

    const domRange = document.createRange();
    try {
      domRange.setStart(start.node, start.offset);
      domRange.setEnd(end.node, end.offset);
      return [domRange];
    } catch {
      return [];
    }
  });

  registry.delete(MANUSCRIPT_SELECTION_HIGHLIGHT);
  if (ranges.length > 0) {
    registry.set(MANUSCRIPT_SELECTION_HIGHLIGHT, new HighlightConstructor(...ranges));
  }
}

function getHighlightRegistry(): HighlightRegistry | null {
  if (typeof CSS === 'undefined') return null;
  return (CSS as typeof CSS & { highlights?: HighlightRegistry }).highlights ?? null;
}

function getHighlightConstructor(): (new (...ranges: Range[]) => unknown) | null {
  return (globalThis as typeof globalThis & {
    Highlight?: new (...ranges: Range[]) => unknown;
  }).Highlight ?? null;
}

function escapeAttributeValue(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/["\\]/gu, '\\$&');
}

function cloneSelectionRange(range: ManuscriptSelectionRange): ManuscriptSelectionRange {
  return {
    start: { ...range.start },
    end: { ...range.end },
  };
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function findBlockEditor(node: Node | null, root: HTMLElement): HTMLElement | null {
  const element = node instanceof Element ? node : node?.parentElement;
  const editor = element?.closest<HTMLElement>('.omi-tiptap-editor[data-block-id]') ?? null;
  return editor && root.contains(editor) ? editor : null;
}

function domPointToTextOffset(root: HTMLElement, node: Node | null, offset: number): number {
  if (!node || !root.contains(node)) return 0;
  const range = document.createRange();
  range.selectNodeContents(root);
  try {
    range.setEnd(node, offset);
  } catch {
    return 0;
  }
  return range.toString().length;
}

function textOffsetToDomPoint(
  root: HTMLElement,
  targetOffset: number,
): { node: Node; offset: number } | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let consumed = 0;
  let last: Text | null = null;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const textNode = node as Text;
    last = textNode;
    const next = consumed + textNode.data.length;
    if (targetOffset <= next) {
      return { node: textNode, offset: Math.max(0, targetOffset - consumed) };
    }
    consumed = next;
  }
  return last ? { node: last, offset: last.data.length } : { node: root, offset: 0 };
}
