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

export function readManuscriptDomSelection(
  root: HTMLElement,
  sections: readonly OmiSection[],
): ManuscriptSelectionRange | null {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null;

  const anchorEditor = findBlockEditor(selection.anchorNode, root);
  const focusEditor = findBlockEditor(selection.focusNode, root);
  if (!anchorEditor || !focusEditor) return null;

  const anchorBlockId = anchorEditor.dataset.blockId;
  const focusBlockId = focusEditor.dataset.blockId;
  if (!anchorBlockId || !focusBlockId) return null;

  const order = getManuscriptBlockOrder(sections);
  const anchorIndex = order.findIndex(({ block }) => block.id === anchorBlockId);
  const focusIndex = order.findIndex(({ block }) => block.id === focusBlockId);
  if (anchorIndex < 0 || focusIndex < 0) return null;

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
  if (anchorIndex < focusIndex) return { start: anchor, end: focus };
  if (anchorIndex > focusIndex) return { start: focus, end: anchor };
  return anchorOffset <= focusOffset
    ? { start: anchor, end: focus }
    : { start: focus, end: anchor };
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
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(domRange);
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
