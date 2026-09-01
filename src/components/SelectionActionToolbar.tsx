import type { Editor } from '@tiptap/core';
import {
  useMemo,
  useState,
  type MouseEvent,
} from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { getTopLevelBlockAtPosition } from '../editor/continuousManuscriptDocument';
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
  const effectiveIndexId = indexDefinitions.some(
    (definition) => definition.id === selectedIndexId,
  )
    ? selectedIndexId
    : (indexDefinitions[0]?.id ?? DEFAULT_INDEX_ID);
  const { from, to } = editor.state.selection;

  if (from === to) return null;

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
    const activeBlock = getTopLevelBlockAtPosition(editor.state.doc, from);
    const blockId = activeBlock?.blockId
      ?? editor.view.dom.getAttribute('data-block-id');
    if (!blockId) return;
    const targetTextOffset = editor.state.doc.textBetween(
      activeBlock?.start ?? 0,
      from,
      ' ',
    ).length;
    const selectedDefinition = indexDefinitions.find((item) => item.id === effectiveIndexId);

    const entry = createManualIndexEntry({
      term: selectedText,
      targetText: selectedText,
      targetTextOffset,
      targetBlockId: blockId,
      indexId: effectiveIndexId,
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
    <div className="omi-selection-action-toolbar" role="group" aria-label="Selection actions">
      <button type="button" onMouseDown={preserveSelection} onClick={() => void runClipboardAction('cut')}>{clipboardCopy.cut}</button>
      <button type="button" onMouseDown={preserveSelection} onClick={() => void runClipboardAction('copy')}>{clipboardCopy.copy}</button>
      <select
        aria-label={indexCopy.choose}
        value={effectiveIndexId}
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
