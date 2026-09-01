import { useEffect } from 'react';

import { stageClipboardSectionChange } from '../app/clipboardActions';
import { useStudioStore } from '../app/useStudioStore';
import {
  createManuscriptClipboardFragment,
  cutManuscriptRange,
  getStoredTextLength,
  OMI_MANUSCRIPT_CLIPBOARD_MIME,
  parseManuscriptClipboardFragment,
  pasteManuscriptFragment,
} from '../editor/manuscriptClipboard';
import {
  decorateManuscriptSelection,
  normalizeManuscriptSelectionRange,
  readManuscriptDomSelection,
  renderManuscriptDomSelection,
  type ManuscriptSelectionPoint,
  type ManuscriptSelectionRange,
} from '../editor/manuscriptDomSelection';
import { requestBlockEditorFocus } from '../editor/blockFocusRegistry';

/**
 * Bridges the browser's document-level selection with Studio's many independent
 * Tiptap editors. Single-editor clipboard work remains native/Tiptap-owned;
 * this controller intervenes only when a selection crosses block boundaries or
 * when an OMI manuscript fragment is pasted.
 */
export function CrossSectionClipboardController() {
  useEffect(() => {
    let drag: CrossEditorDrag | null = null;

    const handleCopy = (event: ClipboardEvent) => {
      handleCrossBlockCopyOrCut(event, false);
    };
    const handleCut = (event: ClipboardEvent) => {
      handleCrossBlockCopyOrCut(event, true);
    };
    const handlePaste = (event: ClipboardEvent) => {
      handleManuscriptPaste(event);
    };
    const handlePointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || event.pointerType === 'touch') return;
      const editor = editorRootForNode(event.target instanceof Node ? event.target : null);
      const root = editor?.closest<HTMLElement>('.omi-continuous-manuscript');
      if (!editor || !root || !editor.isContentEditable) return;

      const sections = useStudioStore.getState().manuscript.sections;
      const point = manuscriptPointAt(root, sections, event.clientX, event.clientY);
      if (!point) return;

      let anchor = point;
      if (event.shiftKey) {
        const selection = window.getSelection();
        const existing = selection && selection.rangeCount > 0
          ? readSelectionEndpoint(root, sections, selection.anchorNode, selection.anchorOffset)
          : null;
        if (existing) anchor = existing;
      }

      drag = { root, anchor, active: false };
      if (event.shiftKey && anchor.blockId !== point.blockId) {
        const range = normalizeManuscriptSelectionRange(sections, anchor, point);
        if (range) {
          drag.active = true;
          event.preventDefault();
          renderCrossEditorSelection(root, sections, range);
        }
      }
    };
    const handlePointerMove = (event: PointerEvent) => {
      if (!drag) return;
      if ((event.buttons & 1) === 0) {
        drag = null;
        return;
      }

      const sections = useStudioStore.getState().manuscript.sections;
      const point = manuscriptPointAt(
        drag.root,
        sections,
        event.clientX,
        event.clientY,
      );
      if (!point) return;
      if (!drag.active && point.blockId === drag.anchor.blockId) return;

      const range = normalizeManuscriptSelectionRange(
        sections,
        drag.anchor,
        point,
      );
      if (!range) return;

      drag.active = true;
      event.preventDefault();
      renderCrossEditorSelection(drag.root, sections, range);
    };
    const handlePointerUp = (event: PointerEvent) => {
      if (!drag) return;
      if (drag.active) {
        event.preventDefault();
        const sections = useStudioStore.getState().manuscript.sections;
        const point = manuscriptPointAt(
          drag.root,
          sections,
          event.clientX,
          event.clientY,
        );
        const range = point
          ? normalizeManuscriptSelectionRange(sections, drag.anchor, point)
          : null;
        if (range) {
          const root = drag.root;
          queueMicrotask(() => renderCrossEditorSelection(root, sections, range));
        }
      }
      drag = null;
    };
    const handlePointerCancel = () => {
      drag = null;
    };
    const handleSelectStart = (event: Event) => {
      if (drag?.active) event.preventDefault();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      handleCrossBlockDeletion(event);
    };

    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('paste', handlePaste, true);
    document.addEventListener('pointerdown', handlePointerDown, true);
    document.addEventListener('pointermove', handlePointerMove, {
      capture: true,
      passive: false,
    });
    document.addEventListener('pointerup', handlePointerUp, true);
    document.addEventListener('pointercancel', handlePointerCancel, true);
    document.addEventListener('selectstart', handleSelectStart, true);
    document.addEventListener('keydown', handleKeyDown, true);
    return () => {
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
      document.removeEventListener('pointerdown', handlePointerDown, true);
      document.removeEventListener('pointermove', handlePointerMove, true);
      document.removeEventListener('pointerup', handlePointerUp, true);
      document.removeEventListener('pointercancel', handlePointerCancel, true);
      document.removeEventListener('selectstart', handleSelectStart, true);
      document.removeEventListener('keydown', handleKeyDown, true);
    };
  }, []);

  return null;
}

interface CrossEditorDrag {
  root: HTMLElement;
  anchor: ManuscriptSelectionPoint;
  active: boolean;
}

function handleCrossBlockDeletion(event: globalThis.KeyboardEvent): void {
  if (event.key !== 'Backspace' && event.key !== 'Delete') return;
  if (event.altKey || event.ctrlKey || event.metaKey || event.isComposing) return;

  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  const anchorRoot = editorRootForNode(selection.anchorNode);
  const focusRoot = editorRootForNode(selection.focusNode);
  if (!anchorRoot || !focusRoot || anchorRoot === focusRoot) return;
  if (!anchorRoot.isContentEditable || !focusRoot.isContentEditable) return;

  const manuscriptRoot = anchorRoot.closest<HTMLElement>('.omi-continuous-manuscript');
  if (!manuscriptRoot || !manuscriptRoot.contains(focusRoot)) return;

  const state = useStudioStore.getState();
  const range = readManuscriptDomSelection(
    manuscriptRoot,
    state.manuscript.sections,
  );
  if (!range || range.start.blockId === range.end.blockId) return;

  const nextSections = cutManuscriptRange(
    state.manuscript.sections,
    range.start.blockId,
    range.start.offset,
    range.end.blockId,
    range.end.offset,
  );
  if (!stageClipboardSectionChange(nextSections, 'Deleted manuscript range')) return;

  event.preventDefault();
  event.stopPropagation();
  selection.removeAllRanges();
  decorateManuscriptSelection(manuscriptRoot, nextSections, null);
  requestBlockEditorFocus(range.start.blockId, 'end');
}

function handleCrossBlockCopyOrCut(event: ClipboardEvent, cut: boolean): void {
  const selection = window.getSelection();
  if (!selection || selection.isCollapsed || selection.rangeCount === 0) return;
  if (!event.clipboardData) return;

  const range = selection.getRangeAt(0);
  const startRoot = editorRootForNode(range.startContainer);
  const endRoot = editorRootForNode(range.endContainer);
  const startBlockId = startRoot?.dataset.blockId;
  const endBlockId = endRoot?.dataset.blockId;

  // Existing Tiptap/native clipboard handling is better for a selection that
  // stays in one editor. We only bridge separate editors here.
  if (
    !startRoot ||
    !endRoot ||
    !startBlockId ||
    !endBlockId ||
    startBlockId === endBlockId
  ) {
    return;
  }
  if (cut && (!startRoot.isContentEditable || !endRoot.isContentEditable)) return;

  const state = useStudioStore.getState();
  const startStoredLength = storedLengthForBlock(state.manuscript.sections, startBlockId);
  const endStoredLength = storedLengthForBlock(state.manuscript.sections, endBlockId);
  if (startStoredLength === undefined || endStoredLength === undefined) return;

  const startOffset = Math.min(
    startStoredLength,
    textOffsetWithin(startRoot, range.startContainer, range.startOffset),
  );
  const endOffset = Math.min(
    endStoredLength,
    textOffsetWithin(endRoot, range.endContainer, range.endOffset),
  );
  const fragment = createManuscriptClipboardFragment(
    state.manuscript.sections,
    startBlockId,
    startOffset,
    endBlockId,
    endOffset,
  );
  if (!fragment) return;

  event.preventDefault();
  event.clipboardData.setData(
    OMI_MANUSCRIPT_CLIPBOARD_MIME,
    JSON.stringify(fragment),
  );
  event.clipboardData.setData('text/plain', selection.toString());
  event.clipboardData.setData('text/html', selectionHtml(range));

  if (!cut) return;

  const nextSections = cutManuscriptRange(
    state.manuscript.sections,
    startBlockId,
    startOffset,
    endBlockId,
    endOffset,
  );
  if (stageClipboardSectionChange(nextSections, 'Cut manuscript range')) {
    selection.removeAllRanges();
    const manuscriptRoot = startRoot.closest<HTMLElement>('.omi-continuous-manuscript');
    if (manuscriptRoot) {
      decorateManuscriptSelection(manuscriptRoot, nextSections, null);
    }
  }
}

function handleManuscriptPaste(event: ClipboardEvent): void {
  const clipboardData = event.clipboardData;
  if (!clipboardData) return;
  const fragment = parseManuscriptClipboardFragment(
    clipboardData.getData(OMI_MANUSCRIPT_CLIPBOARD_MIME),
  );
  if (!fragment) return;

  const targetRoot = editorRootForNode(
    event.target instanceof Node
      ? event.target
      : window.getSelection()?.focusNode ?? null,
  );
  const targetBlockId = targetRoot?.dataset.blockId;
  if (!targetRoot || !targetBlockId || !targetRoot.isContentEditable) return;

  const selection = window.getSelection();
  const range = selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
  let targetOffset = 0;
  if (range && targetRoot.contains(range.startContainer)) {
    targetOffset = textOffsetWithin(
      targetRoot,
      range.startContainer,
      range.startOffset,
    );
  }

  const state = useStudioStore.getState();
  const storedLength = storedLengthForBlock(
    state.manuscript.sections,
    targetBlockId,
  );
  if (storedLength === undefined) return;
  targetOffset = Math.min(storedLength, targetOffset);

  const nextSections = pasteManuscriptFragment(
    state.manuscript.sections,
    targetBlockId,
    targetOffset,
    fragment,
  );
  if (!stageClipboardSectionChange(nextSections, 'Pasted manuscript range')) return;

  event.preventDefault();
}

function renderCrossEditorSelection(
  root: HTMLElement,
  sections: ReturnType<typeof useStudioStore.getState>['manuscript']['sections'],
  range: ManuscriptSelectionRange,
): void {
  renderManuscriptDomSelection(root, range);
  decorateManuscriptSelection(root, sections, range);
}

function manuscriptPointAt(
  root: HTMLElement,
  sections: ReturnType<typeof useStudioStore.getState>['manuscript']['sections'],
  x: number,
  y: number,
): ManuscriptSelectionPoint | null {
  const caret = caretDomPoint(x, y);
  if (caret) {
    const point = readSelectionEndpoint(root, sections, caret.node, caret.offset);
    if (point) return point;
  }

  const editors = Array.from(
    root.querySelectorAll<HTMLElement>('.omi-tiptap-editor[data-block-id]'),
  ).filter((editor) => editor.isContentEditable);
  if (editors.length === 0) return null;

  const nearest = editors.reduce<{ editor: HTMLElement; distance: number } | null>(
    (best, editor) => {
      const rect = editor.getBoundingClientRect();
      const dx = x < rect.left ? rect.left - x : x > rect.right ? x - rect.right : 0;
      const dy = y < rect.top ? rect.top - y : y > rect.bottom ? y - rect.bottom : 0;
      const distance = Math.hypot(dx, dy);
      return !best || distance < best.distance ? { editor, distance } : best;
    },
    null,
  )?.editor;
  const blockId = nearest?.dataset.blockId;
  if (!nearest || !blockId) return null;

  const storedLength = storedLengthForBlock(sections, blockId);
  if (storedLength === undefined) return null;
  const rect = nearest.getBoundingClientRect();
  const after = y > rect.bottom || (y >= rect.top && x >= rect.left + rect.width / 2);
  return { blockId, offset: after ? storedLength : 0 };
}

function readSelectionEndpoint(
  root: HTMLElement,
  sections: ReturnType<typeof useStudioStore.getState>['manuscript']['sections'],
  node: Node | null,
  offset: number,
): ManuscriptSelectionPoint | null {
  const editor = editorRootForNode(node);
  const blockId = editor?.dataset.blockId;
  if (!editor || !blockId || !root.contains(editor)) return null;
  const storedLength = storedLengthForBlock(sections, blockId);
  if (storedLength === undefined) return null;
  return {
    blockId,
    offset: Math.min(storedLength, textOffsetWithin(editor, node ?? editor, offset)),
  };
}

function caretDomPoint(x: number, y: number): { node: Node; offset: number } | null {
  const position = document.caretPositionFromPoint?.(x, y);
  if (position) return { node: position.offsetNode, offset: position.offset };

  const legacyDocument = document as Document & {
    caretRangeFromPoint?: (clientX: number, clientY: number) => Range | null;
  };
  const range = legacyDocument.caretRangeFromPoint?.(x, y);
  return range ? { node: range.startContainer, offset: range.startOffset } : null;
}

function editorRootForNode(node: Node | null): HTMLElement | null {
  if (!node) return null;
  const element = node instanceof Element ? node : node.parentElement;
  return element?.closest<HTMLElement>(
    '.omi-tiptap-editor[data-block-id]',
  ) ?? null;
}

function textOffsetWithin(
  root: HTMLElement,
  endpoint: Node,
  endpointOffset: number,
): number {
  if (endpoint !== root && !root.contains(endpoint)) return 0;
  try {
    const range = document.createRange();
    range.selectNodeContents(root);
    range.setEnd(endpoint, endpointOffset);
    return range.toString().length;
  } catch {
    return 0;
  }
}

function selectionHtml(range: Range): string {
  const container = document.createElement('div');
  container.append(range.cloneContents());
  container
    .querySelectorAll(
      '.omi-selection-action-toolbar, .omi-rich-text-toolbar, [data-block-type-menu]',
    )
    .forEach((element) => element.remove());
  return container.innerHTML;
}

function storedLengthForBlock(
  sections: ReturnType<typeof useStudioStore.getState>['manuscript']['sections'],
  blockId: string,
): number | undefined {
  const block = sections
    .flatMap((section) => section.blocks)
    .find((candidate) => candidate.id === blockId);
  if (!block || block.visual) return undefined;
  return getStoredTextLength(block.content);
}
