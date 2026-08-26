import { Redo2, Undo2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useTranslation } from '../i18n';

const labels: Record<string, { undo: string; redo: string }> = {
  en: { undo: 'Undo', redo: 'Redo' },
  hu: { undo: 'Visszavonás', redo: 'Mégis' },
  de: { undo: 'Rückgängig', redo: 'Wiederholen' },
};

/**
 * Header-level history controls for the currently active Tiptap editor.
 * Tiptap/StarterKit owns the transaction history (100 grouped steps by default),
 * while these controls keep working from the application header without moving
 * the editor selection.
 */
export function UndoRedoControls() {
  const { locale } = useTranslation();
  const copy = labels[locale] ?? labels.en;
  const activeEditorRef = useRef<HTMLElement | null>(null);
  const [hasEditor, setHasEditor] = useState(false);

  useEffect(() => {
    const rememberEditor = (event: FocusEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const editor = target.closest<HTMLElement>('.omi-tiptap-editor, .ProseMirror');
      if (!editor) return;
      activeEditorRef.current = editor;
      setHasEditor(true);
    };

    document.addEventListener('focusin', rememberEditor);
    return () => document.removeEventListener('focusin', rememberEditor);
  }, []);

  function run(kind: 'undo' | 'redo'): void {
    const editor = activeEditorRef.current;
    if (!editor?.isConnected) {
      activeEditorRef.current = null;
      setHasEditor(false);
      return;
    }

    editor.focus({ preventScroll: true });
    const isMac = /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent);
    const event = new KeyboardEvent('keydown', {
      key: kind === 'undo' ? 'z' : isMac ? 'z' : 'y',
      code: kind === 'undo' ? 'KeyZ' : isMac ? 'KeyZ' : 'KeyY',
      ctrlKey: !isMac,
      metaKey: isMac,
      shiftKey: kind === 'redo' && isMac,
      bubbles: true,
      cancelable: true,
    });
    editor.dispatchEvent(event);
  }

  return (
    <div className="focus-history-controls" role="group" aria-label={`${copy.undo} / ${copy.redo}`}>
      <button
        type="button"
        className="focus-insert-menu-trigger focus-history-button"
        aria-label={`${copy.undo} (Ctrl+Z)`}
        title={`${copy.undo} (Ctrl+Z)`}
        disabled={!hasEditor}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => run('undo')}
      >
        <Undo2 size={21} strokeWidth={2.5} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="focus-insert-menu-trigger focus-history-button"
        aria-label={`${copy.redo} (Ctrl+Y / Ctrl+Shift+Z)`}
        title={`${copy.redo} (Ctrl+Y / Ctrl+Shift+Z)`}
        disabled={!hasEditor}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => run('redo')}
      >
        <Redo2 size={21} strokeWidth={2.5} aria-hidden="true" />
      </button>
    </div>
  );
}
