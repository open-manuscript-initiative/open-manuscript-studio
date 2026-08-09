import type { Editor } from '@tiptap/core';
import { useEffect, useState, type CSSProperties } from 'react';

interface SelectionActionToolbarProps {
  editor: Editor;
  citationLabel: string;
  noteLabel: string;
  crossReferenceLabel: string;
  onCitation: () => void;
  onNote: () => void;
  onCrossReference: () => void;
}

interface ToolbarPosition {
  left: number;
  top: number;
  below: boolean;
}

export function SelectionActionToolbar({
  editor,
  citationLabel,
  noteLabel,
  crossReferenceLabel,
  onCitation,
  onNote,
  onCrossReference,
}: SelectionActionToolbarProps) {
  const [position, setPosition] = useState<ToolbarPosition | null>(null);

  useEffect(() => {
    const update = () => {
      const { from, to } = editor.state.selection;
      if (!editor.isFocused || from === to) {
        setPosition(null);
        return;
      }

      try {
        const start = editor.view.coordsAtPos(from);
        const end = editor.view.coordsAtPos(to);
        const below = Math.min(start.top, end.top) < 96;
        setPosition({
          left: Math.max(16, Math.min(window.innerWidth - 16, (start.left + end.right) / 2)),
          top: below ? Math.max(start.bottom, end.bottom) + 12 : Math.min(start.top, end.top) - 12,
          below,
        });
      } catch {
        setPosition(null);
      }
    };

    const clear = () => setPosition(null);
    editor.on('selectionUpdate', update);
    editor.on('focus', update);
    editor.on('blur', clear);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    update();

    return () => {
      editor.off('selectionUpdate', update);
      editor.off('focus', update);
      editor.off('blur', clear);
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [editor]);

  if (!position) return null;

  const style = {
    left: `${position.left}px`,
    top: `${position.top}px`,
  } as CSSProperties;

  const preserveSelection = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  return (
    <div
      className={`omi-selection-action-toolbar${position.below ? ' omi-selection-action-toolbar--below' : ''}`}
      style={style}
      role="toolbar"
      aria-label="Selection actions"
    >
      <button type="button" onMouseDown={preserveSelection} onClick={onCitation}>
        {citationLabel}
      </button>
      <button type="button" onMouseDown={preserveSelection} onClick={onNote}>
        {noteLabel}
      </button>
      <button type="button" onMouseDown={preserveSelection} onClick={onCrossReference}>
        {crossReferenceLabel}
      </button>
    </div>
  );
}
