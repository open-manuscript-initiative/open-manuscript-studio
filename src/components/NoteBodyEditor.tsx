import { BookOpen } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { stageAddNoteCitations } from '../app/noteCitationActions';
import { stageUpdateNoteRichText } from '../app/noteRichTextActions';
import { OmiCitationExtension } from '../editor/extensions/OmiCitationExtension';
import { OMI_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { useTranslation } from '../i18n';
import { getNoteCitationCopy } from '../i18n/noteCitations';
import { createNoteCitation } from '../model/noteCitations';
import {
  collectNoteCitationIds,
  createNoteBodyDocument,
  noteBodyPlainText,
  noteCitationNode,
  synchronizeNoteCitationLabels,
} from '../model/noteRichText';
import type { OmiAnnotation, OmiBibliographicRecord, OmiCitationStyleId } from '../types/omi';
import { CitationPicker, type CitationPickerSelection } from './CitationPicker';

interface NoteBodyEditorProps {
  note: OmiAnnotation;
  records: readonly OmiBibliographicRecord[];
  citationStyle: OmiCitationStyleId;
  manuscriptLocale: string;
}

export function NoteBodyEditor({
  note,
  records,
  citationStyle,
  manuscriptLocale,
}: NoteBodyEditorProps) {
  const { locale } = useTranslation();
  const copy = getNoteCitationCopy(locale);
  const [pickerOpen, setPickerOpen] = useState(false);
  const noteIdRef = useRef(note.id);
  noteIdRef.current = note.id;

  const initial = useMemo(
    () => createNoteBodyDocument(note, records, citationStyle, manuscriptLocale) as JSONContent,
    // Intentionally initialize once per note. External label changes are synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [note.id],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, horizontalRule: false }),
      ...OMI_RICH_TEXT_EXTENSIONS,
      OmiCitationExtension,
    ],
    content: initial,
    editorProps: {
      attributes: {
        class: 'omi-note-rich-editor',
        'aria-label': copy.citations,
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

  useEffect(() => {
    if (!editor) return;
    const synchronized = synchronizeNoteCitationLabels(
      editor.getJSON(),
      note,
      records,
      citationStyle,
      manuscriptLocale,
    ) as JSONContent;
    if (JSON.stringify(synchronized) === JSON.stringify(editor.getJSON())) return;
    editor.commands.setContent(synchronized, { emitUpdate: true });
  }, [citationStyle, editor, manuscriptLocale, note, records]);

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

    editor.chain().focus().insertContent(nodes).run();
    setPickerOpen(false);
  }

  if (!editor) return null;

  return (
    <div className="omi-note-rich-body">
      <EditorContent editor={editor} />
      <div className="omi-note-rich-actions">
        <button
          type="button"
          className="studio-menu-secondary-action"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setPickerOpen((value) => !value)}
        >
          <BookOpen size={15} aria-hidden="true" />
          {copy.addCitation}
        </button>
      </div>
      {pickerOpen ? (
        <CitationPicker
          onInsert={insertCitations}
          onCancel={() => setPickerOpen(false)}
        />
      ) : null}
    </div>
  );
}
