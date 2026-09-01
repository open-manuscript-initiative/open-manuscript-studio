import type { Editor } from '@tiptap/core';

type FocusTarget = 'start' | 'end' | number;

const editors = new Map<string, Editor>();
const pending = new Map<string, FocusTarget>();
let continuousEditor: Editor | null = null;

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
  if (continuousEditor && !continuousEditor.isDestroyed) {
    const range = findContinuousBlockRange(continuousEditor, blockId);
    if (range) {
      const position = target === 'start'
        ? range.start
        : target === 'end'
          ? range.end
          : Math.min(range.end, range.start + Math.max(0, target));
      const targetEditor = continuousEditor;
      queueMicrotask(() => targetEditor.chain().focus().setTextSelection(position).run());
      return;
    }
  }
  pending.set(blockId, target);
}

export function registerContinuousBlockEditor(editor: Editor): () => void {
  continuousEditor = editor;
  for (const [blockId, target] of pending) {
    const range = findContinuousBlockRange(editor, blockId);
    if (!range) continue;
    pending.delete(blockId);
    const position = target === 'start'
      ? range.start
      : target === 'end'
        ? range.end
        : Math.min(range.end, range.start + Math.max(0, target));
    queueMicrotask(() => editor.chain().focus().setTextSelection(position).run());
  }

  return () => {
    if (continuousEditor === editor) continuousEditor = null;
  };
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

function findContinuousBlockRange(
  editor: Editor,
  blockId: string,
): { start: number; end: number } | null {
  let offset = 0;
  for (let index = 0; index < editor.state.doc.childCount; index += 1) {
    const node = editor.state.doc.child(index);
    if (node.attrs.omiBlockId === blockId) {
      return {
        start: Math.min(offset + 1, offset + node.nodeSize - 1),
        end: Math.max(offset + 1, offset + node.nodeSize - 1),
      };
    }
    offset += node.nodeSize;
  }
  return null;
}
