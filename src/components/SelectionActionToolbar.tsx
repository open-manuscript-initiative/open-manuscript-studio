import type { Editor } from '@tiptap/core';
import {
  useEffect,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { createManualNameIndexEntry } from '../model/indexing';

interface SelectionActionToolbarProps {
  editor: Editor;
  citationLabel: string;
  noteLabel: string;
  crossReferenceLabel: string;
  translateLabel?: string;
  assistantLabel?: string;
  onCitation?: () => void;
  onNote?: () => void;
  onCrossReference?: () => void;
  onTranslate?: () => void;
  onAssistant?: () => void;
}

interface ToolbarPosition {
  left: number;
  top: number;
  below: boolean;
}

const indexLabels: Record<string, string> = {
  en: 'Add to name index',
  hu: 'Névmutató-jelölés',
  de: 'Zum Personenregister',
};

export function SelectionActionToolbar({
  editor,
  citationLabel,
  noteLabel,
  crossReferenceLabel,
  translateLabel,
  assistantLabel,
  onCitation,
  onNote,
  onCrossReference,
  onTranslate,
  onAssistant,
}: SelectionActionToolbarProps) {
  const { locale } = useTranslation();
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
          left: Math.max(
            16,
            Math.min(window.innerWidth - 16, (start.left + end.right) / 2),
          ),
          top: below
            ? Math.max(start.bottom, end.bottom) + 12
            : Math.min(start.top, end.top) - 12,
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

  const preserveSelection = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
  };

  const addNameIndexEntry = () => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!selectedText) return;
    const blockId = editor.view.dom.getAttribute('data-block-id');
    if (!blockId) return;

    const entry = createManualNameIndexEntry({
      term: selectedText,
      targetText: selectedText,
      targetBlockId: blockId,
    });

    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        indexEntries: [...(state.manuscript.indexEntries ?? []), entry],
        updatedAt: new Date().toISOString(),
      },
    }));
    editor.commands.setTextSelection(to);
    editor.commands.focus();
  };

  return (
    <div
      className={`omi-selection-action-toolbar${
        position.below ? ' omi-selection-action-toolbar--below' : ''
      }`}
      style={style}
      role="toolbar"
      aria-label="Selection actions"
    >
      <button type="button" onMouseDown={preserveSelection} onClick={addNameIndexEntry}>
        {indexLabels[locale] ?? indexLabels.en}
      </button>
      {onCitation ? (
        <button type="button" onMouseDown={preserveSelection} onClick={onCitation}>
          {citationLabel}
        </button>
      ) : null}
      {onNote ? (
        <button type="button" onMouseDown={preserveSelection} onClick={onNote}>
          {noteLabel}
        </button>
      ) : null}
      {onCrossReference ? (
        <button type="button" onMouseDown={preserveSelection} onClick={onCrossReference}>
          {crossReferenceLabel}
        </button>
      ) : null}
      {onTranslate ? (
        <button type="button" onMouseDown={preserveSelection} onClick={onTranslate}>
          {translateLabel ?? 'Translate'}
        </button>
      ) : null}
      {onAssistant ? (
        <button type="button" onMouseDown={preserveSelection} onClick={onAssistant}>
          {assistantLabel ?? 'Assistant'}
        </button>
      ) : null}
    </div>
  );
}
