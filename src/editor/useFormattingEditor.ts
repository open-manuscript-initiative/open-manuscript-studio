import type { Editor } from '@tiptap/core';
import { cloneElement, isValidElement, useEffect, useRef, type ReactNode } from 'react';
import { create } from 'zustand';

interface FormattingTarget {
  editor: Editor;
  noteId: string | null;
  insertCitation: (() => void) | null;
  renderActions: () => ReactNode;
}

const PIN_PREFERENCE = 'omi.headerFormattingPinned.v1';
function readPinned(): boolean {
  try { return window.localStorage.getItem(PIN_PREFERENCE) === 'true'; }
  catch { return false; }
}
const pinned = readPinned();

export const useFormattingStore = create<{
  target: FormattingTarget | null;
  open: boolean;
  pinned: boolean;
}>(() => ({ target: null, open: pinned && typeof window !== 'undefined' && window.innerWidth > 760, pinned }));

useFormattingStore.subscribe((state, previous) => {
  if (state.pinned === previous.pinned) return;
  try { window.localStorage.setItem(PIN_PREFERENCE, String(state.pinned)); } catch { /* The preference is optional. */ }
});

/** Keep the last editable surface selected while the user operates the header. */
export function useFormattingEditor(
  editor: Editor | null,
  options: { noteId?: string; onCitation?: () => void; actions?: ReactNode } = {},
): void {
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const noteId = options.noteId ?? null;

  useEffect(() => {
    if (!editor) return;
    const activate = () => {
      if (editor.isDestroyed || !editor.isEditable) return;
      const current = useFormattingStore.getState().target;
      if (current?.editor === editor && current.noteId === noteId) return;
      useFormattingStore.setState({ target: {
        editor,
        noteId,
        insertCitation: optionsRef.current.onCitation
          ? () => optionsRef.current.onCitation?.()
          : null,
        renderActions: () => {
          const actions = optionsRef.current.actions;
          // Selection tools also read live editor state. Refresh their element
          // when the shared toolbar receives an editor transaction.
          return isValidElement(actions) ? cloneElement(actions) : actions;
        },
      } });
    };
    const onSelection = () => { if (editor.isFocused) activate(); };
    const clear = () => {
      if (useFormattingStore.getState().target?.editor === editor) {
        useFormattingStore.setState({ target: null });
      }
    };
    const checkEditable = () => { if (!editor.isEditable) clear(); };
    editor.on('focus', activate);
    editor.on('selectionUpdate', onSelection);
    editor.on('destroy', clear);
    editor.on('transaction', checkEditable);
    if (editor.isFocused || (!noteId && !useFormattingStore.getState().target)) activate();
    return () => {
      editor.off('focus', activate);
      editor.off('selectionUpdate', onSelection);
      editor.off('destroy', clear);
      editor.off('transaction', checkEditable);
      clear();
    };
  }, [editor, noteId]);
}
