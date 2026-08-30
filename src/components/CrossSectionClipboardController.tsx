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

/**
 * Bridges the browser's document-level selection with Studio's many independent
 * Tiptap editors. Single-editor clipboard work remains native/Tiptap-owned;
 * this controller intervenes only when a selection crosses block boundaries or
 * when an OMI manuscript fragment is pasted.
 */
export function CrossSectionClipboardController() {
  useEffect(() => {
    const handleCopy = (event: ClipboardEvent) => {
      handleCrossBlockCopyOrCut(event, false);
    };
    const handleCut = (event: ClipboardEvent) => {
      handleCrossBlockCopyOrCut(event, true);
    };
    const handlePaste = (event: ClipboardEvent) => {
      handleManuscriptPaste(event);
    };

    document.addEventListener('copy', handleCopy, true);
    document.addEventListener('cut', handleCut, true);
    document.addEventListener('paste', handlePaste, true);
    return () => {
      document.removeEventListener('copy', handleCopy, true);
      document.removeEventListener('cut', handleCut, true);
      document.removeEventListener('paste', handlePaste, true);
    };
  }, []);

  return null;
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
