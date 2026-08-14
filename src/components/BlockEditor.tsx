import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import {
  EditorContent,
  type JSONContent,
  useEditor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import {
  reconcileCitationsAfterBlockEdit,
  stageCreateCitationCluster,
} from '../app/citationActions';
import {
  reconcileCrossReferencesAfterBlockEdit,
  stageCreateCrossReference,
} from '../app/crossReferenceActions';
import {
  reconcileNotesAfterBlockEdit,
  stageCreateNote,
} from '../app/noteActions';
import { useStudioStore } from '../app/useStudioStore';
import { OmiCitationExtension } from '../editor/extensions/OmiCitationExtension';
import { OmiCrossReferenceExtension } from '../editor/extensions/OmiCrossReferenceExtension';
import {
  OmiNoteExtension,
  type OmiNoteAttributes,
} from '../editor/extensions/OmiNoteExtension';
import { OMI_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { useTranslation } from '../i18n';
import { getCrossReferenceCopy } from '../i18n/crossReferences';
import type { TranslationKey } from '../i18n/types';
import { createCitationCluster } from '../model/citationClusters';
import {
  createCrossReference,
  formatCrossReferenceLabel,
  resolveCrossReferenceTarget,
} from '../model/crossReferences';
import { renderCitationCluster } from '../model/cslRendering';
import { sanitizeRichTextPasteHtml } from '../model/richText';
import type {
  OmiCrossReferenceDisplayStyle,
  OmiCrossReferenceTargetKind,
} from '../types/omi';
import { CitationClusterEditorCard } from './CitationClusterEditorCard';
import { CitationEditorCard } from './CitationEditorCard';
import {
  CitationPicker,
  type CitationPickerSelection,
} from './CitationPicker';
import { CrossReferenceEditorCard } from './CrossReferenceEditorCard';
import { CrossReferencePicker } from './CrossReferencePicker';
import { NoteEditorCard } from './NoteEditorCard';
import { RichTextToolbar } from './RichTextToolbar';
import { SelectionActionToolbar } from './SelectionActionToolbar';

interface BlockEditorProps {
  blockId: string;
  blockType: string;
  content: string;
  onUpdate: (blockId: string, content: string) => void;
  editable?: boolean;
  restricted?: boolean;
  manuscriptLanguage?: string;
  className?: string;
}

export function BlockEditor({
  blockId,
  blockType,
  content,
  onUpdate,
  editable = true,
  restricted = false,
  manuscriptLanguage,
  className,
}: BlockEditorProps) {
  const { t, locale } = useTranslation();
  const crossReferenceCopy = getCrossReferenceCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [activeCrossReferenceId, setActiveCrossReferenceId] = useState<string | null>(null);
  const [citationPickerOpen, setCitationPickerOpen] = useState(false);
  const [crossReferencePickerOpen, setCrossReferencePickerOpen] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  const tRef = useRef(t);
  const blockLabel = formatBlockType(blockType, t);
  const editorStyle = {
    '--omi-editor-placeholder': JSON.stringify(t('editor.emptyParagraph')),
  } as CSSProperties;

  const activeCitation = activeCitationId
    ? manuscript.citations.find((citation) => citation.id === activeCitationId)
    : undefined;
  const activeCluster = activeCitation?.clusterId
    ? (manuscript.citationClusters ?? []).find(
        (cluster) => cluster.id === activeCitation.clusterId,
      )
    : undefined;

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  useEffect(() => {
    tRef.current = t;
  }, [t]);

  useEffect(() => {
    if (restricted) return;
    if (activeNoteId && !manuscript.annotations.some((annotation) => annotation.id === activeNoteId)) {
      setActiveNoteId(null);
    }
  }, [activeNoteId, manuscript.annotations, restricted]);

  useEffect(() => {
    if (restricted) return;
    if (activeCitationId && !manuscript.citations.some((citation) => citation.id === activeCitationId)) {
      setActiveCitationId(null);
    }
  }, [activeCitationId, manuscript.citations, restricted]);

  useEffect(() => {
    if (restricted) return;
    if (
      activeCrossReferenceId &&
      !(manuscript.crossReferences ?? []).some((reference) => reference.id === activeCrossReferenceId)
    ) {
      setActiveCrossReferenceId(null);
    }
  }, [activeCrossReferenceId, manuscript.crossReferences, restricted]);

  const editor = useEditor({
    editable,
    extensions: [
      StarterKit.configure(
        restricted
          ? { horizontalRule: false }
          : { heading: false, horizontalRule: false },
      ),
      ...OMI_RICH_TEXT_EXTENSIONS,
      ...(restricted
        ? []
        : [
            OmiNoteExtension.configure({
              onNoteInserted: (attributes: OmiNoteAttributes) => {
                stageCreateNote({
                  id: attributes.noteId,
                  anchorId: attributes.anchorId,
                  targetBlockId: blockId,
                  kind: attributes.noteType,
                });
                setActiveNoteId(attributes.noteId);
                setActiveCitationId(null);
                setActiveCrossReferenceId(null);
              },
              accessibleLabel: (attributes: OmiNoteAttributes) =>
                `${tRef.current('notes.note')} ${attributes.label}`,
            }),
            OmiCitationExtension,
            OmiCrossReferenceExtension,
          ]),
    ],
    content: parseStoredContent(content),
    editorProps: {
      attributes: {
        class: 'omi-tiptap-editor',
        'data-block-id': blockId,
        'data-block-type': blockType,
        'aria-label': `${blockLabel}: ${t('studio.editorAria')}`,
        spellcheck: 'true',
      },
      transformPastedHTML: (html) => sanitizeRichTextPasteHtml(html),
      handleClick: (_view, _pos, event) => {
        if (restricted) return false;
        const target = event.target;
        if (!(target instanceof Element)) return false;

        const crossReferenceId = target
          .closest<HTMLElement>('[data-omi-cross-reference][data-cross-reference-id]')
          ?.dataset.crossReferenceId;
        if (crossReferenceId) {
          setActiveCrossReferenceId(crossReferenceId);
          setActiveCitationId(null);
          setActiveNoteId(null);
          setCitationPickerOpen(false);
          setCrossReferencePickerOpen(false);
          return true;
        }

        const citationId = target
          .closest<HTMLElement>('[data-omi-citation][data-citation-id]')
          ?.dataset.citationId;
        if (citationId) {
          setActiveCitationId(citationId);
          setActiveCrossReferenceId(null);
          setActiveNoteId(null);
          setCitationPickerOpen(false);
          setCrossReferencePickerOpen(false);
          return true;
        }

        const noteId = target
          .closest<HTMLElement>('[data-omi-note][data-note-id]')
          ?.dataset.noteId;
        if (!noteId) return false;

        setActiveNoteId(noteId);
        setActiveCitationId(null);
        setActiveCrossReferenceId(null);
        setCitationPickerOpen(false);
        setCrossReferencePickerOpen(false);
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onUpdateRef.current(blockId, JSON.stringify(currentEditor.getJSON()));
      if (!restricted) {
        reconcileNotesAfterBlockEdit();
        reconcileCitationsAfterBlockEdit();
        reconcileCrossReferencesAfterBlockEdit();
      }
    },
  });

  useEffect(() => {
    editor?.setEditable(editable);
  }, [editable, editor]);

  useEffect(() => {
    if (!editor) return;
    const incomingDocument = parseStoredContent(content);
    if (documentsAreEqual(editor.getJSON(), incomingDocument)) return;
    editor.commands.setContent(incomingDocument, { emitUpdate: false });
  }, [content, editor]);

  function closeSecondaryEditors(): void {
    setActiveNoteId(null);
    setActiveCitationId(null);
    setActiveCrossReferenceId(null);
  }

  function collapseSelectionToEnd(): void {
    if (!editor) return;
    const { to } = editor.state.selection;
    editor.commands.setTextSelection(to);
  }

  function openCitationPicker(): void {
    if (!editor || restricted) return;
    collapseSelectionToEnd();
    setCitationPickerOpen(true);
    setCrossReferencePickerOpen(false);
    closeSecondaryEditors();
  }

  function openCrossReferencePicker(): void {
    if (!editor || restricted) return;
    collapseSelectionToEnd();
    setCrossReferencePickerOpen(true);
    setCitationPickerOpen(false);
    closeSecondaryEditors();
  }

  function insertNote(): void {
    if (!editor || restricted) return;
    collapseSelectionToEnd();
    setCitationPickerOpen(false);
    setCrossReferencePickerOpen(false);
    closeSecondaryEditors();
    editor.chain().focus().insertOmiNote({ noteType: 'footnote' }).insertContent(' ').run();
  }

  function insertCitationCluster(selections: CitationPickerSelection[]): void {
    if (!editor || restricted || selections.length === 0) return;
    const records = manuscript.bibliographicRecords ?? [];
    const validSelections = selections.filter((selection) =>
      records.some((record) => record.id === selection.recordId),
    );
    if (validSelections.length === 0) return;

    const creation = createCitationCluster(
      validSelections.map((selection) => ({
        target: selection.recordId,
        locator: selection.locator,
      })),
      blockId,
    );
    const label = renderCitationCluster(
      creation.citations,
      records,
      manuscript.citationStyle,
      manuscript.locale,
    );
    const firstCitation = creation.citations[0];
    if (!firstCitation) return;

    const inserted = editor
      .chain()
      .focus()
      .insertOmiCitation({
        citationId: firstCitation.id,
        citationIds: creation.cluster.citationIds,
        clusterId: creation.cluster.id,
        anchorId: creation.cluster.anchorId,
        label,
      })
      .insertContent(' ')
      .run();

    if (inserted && stageCreateCitationCluster(creation)) {
      setCitationPickerOpen(false);
      setCrossReferencePickerOpen(false);
      setActiveCitationId(firstCitation.id);
      setActiveCrossReferenceId(null);
      setActiveNoteId(null);
    }
  }

  function insertCrossReference(
    targetId: string,
    targetKind: OmiCrossReferenceTargetKind,
    displayStyle: OmiCrossReferenceDisplayStyle,
  ): void {
    if (!editor || restricted) return;
    const target = resolveCrossReferenceTarget(manuscript, targetId);
    if (!target || target.kind !== targetKind) return;

    const reference = createCrossReference({
      targetId,
      targetKind,
      sourceBlockId: blockId,
      displayStyle,
    });
    const label = formatCrossReferenceLabel(reference, target, manuscript.locale);
    const inserted = editor
      .chain()
      .focus()
      .insertOmiCrossReference({
        crossReferenceId: reference.id,
        anchorId: reference.anchorId,
        label,
        unresolved: false,
      })
      .insertContent(' ')
      .run();

    if (inserted && stageCreateCrossReference(reference)) {
      setCrossReferencePickerOpen(false);
      setCitationPickerOpen(false);
      setActiveCrossReferenceId(reference.id);
      setActiveCitationId(null);
      setActiveNoteId(null);
    }
  }

  if (!editor) {
    return (
      <div className="omi-block-editor omi-block-editor--loading" aria-live="polite">
        {t('editor.loading')}
      </div>
    );
  }

  return (
    <article
      className={`omi-block-editor${className ? ` ${className}` : ''}`}
      data-block-id={blockId}
      id={`omi-target-${blockId}`}
      style={editorStyle}
    >
      <EditorContent editor={editor} />

      {editable ? (
        <RichTextToolbar
          editor={editor}
          locale={locale}
          manuscriptLanguage={manuscriptLanguage ?? manuscript.locale}
        />
      ) : null}

      {!restricted && editable ? (
        <SelectionActionToolbar
          editor={editor}
          citationLabel={t('editor.addCitation')}
          noteLabel={t('editor.addNote')}
          crossReferenceLabel={crossReferenceCopy.insert}
          onCitation={openCitationPicker}
          onNote={insertNote}
          onCrossReference={openCrossReferencePicker}
        />
      ) : null}

      {!restricted && crossReferencePickerOpen ? (
        <CrossReferencePicker
          onInsert={insertCrossReference}
          onCancel={() => setCrossReferencePickerOpen(false)}
        />
      ) : null}

      {!restricted && citationPickerOpen ? (
        <CitationPicker
          onInsert={insertCitationCluster}
          onCancel={() => setCitationPickerOpen(false)}
        />
      ) : null}

      {!restricted && activeCrossReferenceId ? (
        <CrossReferenceEditorCard
          crossReferenceId={activeCrossReferenceId}
          onClose={() => setActiveCrossReferenceId(null)}
        />
      ) : null}

      {!restricted && activeCitationId && activeCluster && activeCluster.citationIds.length > 1 ? (
        <CitationClusterEditorCard
          clusterId={activeCluster.id}
          onClose={() => setActiveCitationId(null)}
        />
      ) : !restricted && activeCitationId ? (
        <CitationEditorCard
          citationId={activeCitationId}
          onClose={() => setActiveCitationId(null)}
        />
      ) : null}

      {!restricted && activeNoteId ? (
        <NoteEditorCard compact noteId={activeNoteId} onClose={() => setActiveNoteId(null)} />
      ) : null}
    </article>
  );
}

function parseStoredContent(content: string): JSONContent {
  if (content.trim().length === 0) return createParagraphDocument('');
  try {
    const parsed: unknown = JSON.parse(content);
    if (isTiptapDocument(parsed)) return parsed;
  } catch {
    // Legacy textarea content opens as plain paragraph text.
  }
  return createParagraphDocument(content);
}

function createParagraphDocument(text: string): JSONContent {
  if (text.length === 0) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }
  return {
    type: 'doc',
    content: [{
      type: 'paragraph',
      content: [{ type: 'text', text }],
    }],
  };
}

function isTiptapDocument(value: unknown): value is JSONContent {
  if (!isRecord(value)) return false;
  if (value.type !== 'doc') return false;
  return value.content === undefined || Array.isArray(value.content);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function documentsAreEqual(first: JSONContent, second: JSONContent): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

function formatBlockType(
  blockType: string,
  t: (key: TranslationKey) => string,
): string {
  switch (blockType) {
    case 'paragraph':
      return t('editor.paragraph');
    case 'heading':
      return t('editor.heading');
    case 'quote':
      return t('editor.quote');
    default:
      return blockType;
  }
}
