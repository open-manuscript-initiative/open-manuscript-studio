import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { stageAddNoteCitations } from '../app/noteCitationActions';
import { stageUpdateNoteRichText } from '../app/noteRichTextActions';
import { OmiCitationExtension } from '../editor/extensions/OmiCitationExtension';
import { OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { useFormattingEditor } from '../editor/useFormattingEditor';
import { useTranslation } from '../i18n';
import { createNoteCitation } from '../model/noteCitations';
import {
  collectNoteCitationIds,
  createNoteBodyDocument,
  noteBodyPlainText,
  noteCitationNode,
  type NoteCitationStyleOptions,
} from '../model/noteRichText';
import type { OmiAnnotation, OmiBibliographicRecord, OmiCitationStyleId } from '../types/omi';
import { CitationPicker, type CitationPickerSelection } from './CitationPicker';

interface NoteBodyEditorProps {
  note: OmiAnnotation;
  records: readonly OmiBibliographicRecord[];
  citationStyle: OmiCitationStyleId;
  manuscriptLocale: string;
  subsequentCitationStyle?: OmiCitationStyleId;
  previouslyCitedTargets?: readonly string[];
}

export function NoteBodyEditor({
  note,
  records,
  citationStyle,
  manuscriptLocale,
  subsequentCitationStyle,
  previouslyCitedTargets,
}: NoteBodyEditorProps) {
  const { t } = useTranslation();
  const previousTargetsKey = (previouslyCitedTargets ?? []).join('\u0000');
  const styleOptions = useMemo<NoteCitationStyleOptions>(() => ({
    subsequentStyle: subsequentCitationStyle,
    previouslyCitedTargets: previousTargetsKey ? previousTargetsKey.split('\u0000') : [],
  }), [previousTargetsKey, subsequentCitationStyle]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const noteIdRef = useRef(note.id);
  const insertionPosRef = useRef<number | null>(null);
  noteIdRef.current = note.id;

  const initial = useMemo(
    () => createNoteBodyDocument(note, records, citationStyle, manuscriptLocale, styleOptions) as JSONContent,
    // Intentionally initialize once per note. External label changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note.id],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, horizontalRule: false }),
      ...OMI_CONTINUOUS_RICH_TEXT_EXTENSIONS.filter((extension) => extension.name !== 'omiBlockTypeMenu'),
      OmiCitationExtension,
    ],
    content: initial,
    editorProps: {
      attributes: {
        class: 'omi-note-rich-editor',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': t('notes.body'),
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      const json = currentEditor.getJSON() as JSONContent;
      stageUpdateNoteRichText(
        noteIdRef.current,
        JSON.stringify(json),
        noteBodyPlainText(json),
        collectNoteCitationIds(json),
      );
    },
  });

  useFormattingEditor(editor, { noteId: note.id, onCitation: togglePicker });

  useEffect(() => {
    if (!editor) return;
    // Both the footer and the note card edit the same annotation. Apply external
    // edits without writing them back or moving the current text selection.
    const synchronized = editor.schema.nodeFromJSON(createNoteBodyDocument(
      note, records, citationStyle, manuscriptLocale, styleOptions,
    )).toJSON() as JSONContent;
    if (JSON.stringify(synchronized) === JSON.stringify(editor.getJSON())) return;
    const { from, to } = editor.state.selection;
    editor.commands.setContent(synchronized, { emitUpdate: false });
    const max = editor.state.doc.content.size;
    editor.commands.setTextSelection({ from: Math.min(from, max), to: Math.min(to, max) });
  }, [citationStyle, editor, manuscriptLocale, note, records, styleOptions]);

  function togglePicker(): void {
    if (!editor) return;
    if (!pickerOpen) insertionPosRef.current = editor.state.selection.to;
    setPickerOpen((value) => !value);
  }

  function insertCitations(selections: CitationPickerSelection[]): void {
    if (!editor || selections.length === 0) return;
    const created = selections.map((selection) =>
      createNoteCitation(selection.recordId, selection.locator),
    );
    if (!stageAddNoteCitations(note.id, created)) return;

    const nodes = created.flatMap((citation, index) => {
      const node = noteCitationNode(
        citation,
        note,
        records,
        citationStyle,
        manuscriptLocale,
      );
      return index === 0
        ? [node]
        : [{ type: 'text', text: '; ' }, node];
    });

    const maxPosition = editor.state.doc.content.size;
    const position = Math.max(1, Math.min(insertionPosRef.current ?? editor.state.selection.to, maxPosition));
    editor.chain().focus().insertContentAt(position, nodes, { updateSelection: true }).run();
    insertionPosRef.current = null;
    setPickerOpen(false);
  }

  if (!editor) return null;

  return (
    <div className="omi-note-rich-body">
      <EditorContent editor={editor} />
      {pickerOpen ? (
        <CitationPicker
          onInsert={insertCitations}
          onCancel={() => {
            insertionPosRef.current = null;
            setPickerOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}
