import type { Editor } from '@tiptap/core';

type FocusTarget = 'start' | 'end' | number;

const editors = new Map<string, Editor>();
const pending = new Map<string, FocusTarget>();

export function registerBlockEditor(blockId: string, editor: Editor): () => void {
  editors.set(blockId, editor);
  const target = pending.get(blockId);
  if (target !== undefined) {
    pending.delete(blockId);
    queueMicrotask(() => focusEditor(editor, target));
  }

  return () => {
    if (editors.get(blockId) === editor) editors.delete(blockId);
  };
}

export function requestBlockEditorFocus(blockId: string, target: FocusTarget): void {
  const editor = editors.get(blockId);
  if (editor) {
    queueMicrotask(() => focusEditor(editor, target));
    return;
  }
  pending.set(blockId, target);
}

function focusEditor(editor: Editor, target: FocusTarget): void {
  if (editor.isDestroyed) return;
  if (target === 'start' || target === 'end') {
    editor.commands.focus(target);
    return;
  }
  const maximum = Math.max(1, editor.state.doc.content.size - 1);
  editor.chain().focus().setTextSelection(Math.min(Math.max(1, target), maximum)).run();
}
