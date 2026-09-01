import type { Editor } from '@tiptap/core';
import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  createManualIndexEntry,
  DEFAULT_INDEX_ID,
  getDocumentIndexDefinitions,
} from '../model/indexing';

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

const indexLabels: Record<string, { action: string; choose: string }> = {
  en: { action: 'Add to index', choose: 'Index' },
  hu: { action: 'Mutatóba', choose: 'Mutató' },
  de: { action: 'Zum Register', choose: 'Register' },
};

const clipboardLabels: Record<string, { cut: string; copy: string }> = {
  en: { cut: 'Cut', copy: 'Copy' },
  hu: { cut: 'Kivágás', copy: 'Másolás' },
  de: { cut: 'Ausschneiden', copy: 'Kopieren' },
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
  const manuscript = useStudioStore((state) => state.manuscript);
  const [position, setPosition] = useState<ToolbarPosition | null>(null);
  const indexCopy = indexLabels[locale] ?? indexLabels.en;
  const clipboardCopy = clipboardLabels[locale] ?? clipboardLabels.en;
  const indexDefinitions = useMemo(
    () => getDocumentIndexDefinitions({
      locale,
      indexDefinitions: manuscript.indexDefinitions,
      entries: manuscript.indexEntries,
    }),
    [locale, manuscript.indexDefinitions, manuscript.indexEntries],
  );
  const [selectedIndexId, setSelectedIndexId] = useState(DEFAULT_INDEX_ID);

  useEffect(() => {
    if (!indexDefinitions.some((definition) => definition.id === selectedIndexId)) {
      setSelectedIndexId(indexDefinitions[0]?.id ?? DEFAULT_INDEX_ID);
    }
  }, [indexDefinitions, selectedIndexId]);

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

  useEffect(() => {
    if (!isMobileSelectionEnvironment()) return;

    const editorDom = editor.view.dom;
    const previousTouchCallout = editorDom.style.getPropertyValue('-webkit-touch-callout');
    editorDom.style.setProperty('-webkit-touch-callout', 'none');

    const suppressNativeSelectionMenu = (event: Event) => {
      const { from, to } = editor.state.selection;
      if (from === to) return;
      event.preventDefault();
      event.stopPropagation();
    };

    editorDom.addEventListener('contextmenu', suppressNativeSelectionMenu, true);
    return () => {
      editorDom.removeEventListener('contextmenu', suppressNativeSelectionMenu, true);
      if (previousTouchCallout) {
        editorDom.style.setProperty('-webkit-touch-callout', previousTouchCallout);
      } else {
        editorDom.style.removeProperty('-webkit-touch-callout');
      }
    };
  }, [editor]);

  if (!position) return null;

  const style = { left: `${position.left}px`, top: `${position.top}px` } as CSSProperties;
  const preserveSelection = (event: MouseEvent<HTMLElement>) => event.preventDefault();

  const runClipboardAction = async (action: 'copy' | 'cut') => {
    editor.commands.focus();

    // Keep the system clipboard as the destination even when Studio suppresses
    // the native mobile text-selection action menu. execCommand uses the
    // WebView/browser clipboard pipeline and preserves rich editor markup.
    if (typeof document.execCommand === 'function' && document.execCommand(action)) return;

    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, '\n');
    try {
      await navigator.clipboard.writeText(text);
      if (action === 'cut') editor.chain().focus().deleteSelection().run();
    } catch {
      // If clipboard permissions are unavailable, leave the document intact.
    }
  };

  const addIndexEntry = () => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const selectedText = editor.state.doc.textBetween(from, to, ' ').trim();
    if (!selectedText) return;
    const blockId = editor.view.dom.getAttribute('data-block-id');
    if (!blockId) return;
    const targetTextOffset = editor.state.doc.textBetween(0, from, ' ').length;
    const selectedDefinition = indexDefinitions.find((item) => item.id === selectedIndexId);

    const entry = createManualIndexEntry({
      term: selectedText,
      targetText: selectedText,
      targetTextOffset,
      targetBlockId: blockId,
      indexId: selectedIndexId,
      kind: selectedDefinition?.kind ?? 'index',
    });

    useStudioStore.setState((state) => ({
      manuscript: {
        ...state.manuscript,
        indexDefinitions: state.manuscript.indexDefinitions?.length
          ? state.manuscript.indexDefinitions
          : indexDefinitions,
        indexEntries: [...(state.manuscript.indexEntries ?? []), entry],
        updatedAt: new Date().toISOString(),
      },
    }));
    editor.commands.setTextSelection(to);
    editor.commands.focus();
  };

  return (
    <div className={`omi-selection-action-toolbar${position.below ? ' omi-selection-action-toolbar--below' : ''}`} style={style} role="toolbar" aria-label="Selection actions">
      <button type="button" onMouseDown={preserveSelection} onClick={() => void runClipboardAction('cut')}>{clipboardCopy.cut}</button>
      <button type="button" onMouseDown={preserveSelection} onClick={() => void runClipboardAction('copy')}>{clipboardCopy.copy}</button>
      <select
        aria-label={indexCopy.choose}
        value={selectedIndexId}
        onMouseDown={preserveSelection}
        onChange={(event) => setSelectedIndexId(event.target.value)}
      >
        {indexDefinitions.map((definition) => (
          <option key={definition.id} value={definition.id}>{definition.title}</option>
        ))}
      </select>
      <button type="button" onMouseDown={preserveSelection} onClick={addIndexEntry}>{indexCopy.action}</button>
      {onCitation ? <button type="button" onMouseDown={preserveSelection} onClick={onCitation}>{citationLabel}</button> : null}
      {onNote ? <button type="button" onMouseDown={preserveSelection} onClick={onNote}>{noteLabel}</button> : null}
      {onCrossReference ? <button type="button" onMouseDown={preserveSelection} onClick={onCrossReference}>{crossReferenceLabel}</button> : null}
      {onTranslate ? <button type="button" onMouseDown={preserveSelection} onClick={onTranslate}>{translateLabel ?? 'Translate'}</button> : null}
      {onAssistant ? <button type="button" onMouseDown={preserveSelection} onClick={onAssistant}>{assistantLabel ?? 'Assistant'}</button> : null}
    </div>
  );
}

function isMobileSelectionEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent ?? '';
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;
  return navigator.maxTouchPoints > 1 && typeof window !== 'undefined'
    && window.matchMedia('(pointer: coarse)').matches;
}
