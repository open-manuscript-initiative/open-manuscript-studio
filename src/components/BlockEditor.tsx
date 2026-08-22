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
import {
  getEditorCapabilities,
  type EditorCapabilities,
} from '../editor/editorCapabilities';
import { OmiCitationExtension } from '../editor/extensions/OmiCitationExtension';
import { OmiCrossReferenceExtension } from '../editor/extensions/OmiCrossReferenceExtension';
import {
  OmiNoteExtension,
  type OmiNoteAttributes,
} from '../editor/extensions/OmiNoteExtension';
import { OmiProofreadingExtension } from '../editor/extensions/OmiProofreadingExtension';
import { OMI_RICH_TEXT_EXTENSIONS } from '../editor/extensions/OmiRichTextExtensions';
import { useEditorProofreading } from '../editor/useEditorProofreading';
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
import { ProofreadingSuggestionCard } from './ProofreadingSuggestionCard';
import { RichTextToolbar } from './RichTextToolbar';
import { SelectionActionToolbar } from './SelectionActionToolbar';
import { SelectionIntegrationDialog } from './SelectionIntegrationDialog';

interface BlockEditorProps {
  blockId: string;
  blockType: string;
  content: string;
  onUpdate: (blockId: string, content: string) => void;
  editable?: boolean;
  capabilities?: EditorCapabilities;
  manuscriptLanguage?: string;
  className?: string;
}

export function BlockEditor({
  blockId,
  blockType,
  content,
  onUpdate,
  editable = true,
  capabilities = getEditorCapabilities('author'),
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
  const [integrationAction, setIntegrationAction] = useState<'translate' | 'agent' | null>(null);
  const onUpdateRef = useRef(onUpdate);
  const tRef = useRef(t);
  const proofreadingSelectRef = useRef<(id: string | null) => void>(() => undefined);
  const blockLabel = formatBlockType(blockType, t);
  const effectiveEditable = editable && capabilities.editText;
  const externalIntegrationsAllowed = effectiveEditable && capabilities.reconcileWorkspaceReferences;
  const editorStyle = {
    '--omi-editor-placeholder': JSON.stringify(t('editor.emptyParagraph')),
  } as CSSProperties;
  const integrationLabels = getIntegrationActionLabels(locale);

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
    if (!capabilities.insertNotes) return;
    if (activeNoteId && !manuscript.annotations.some((annotation) => annotation.id === activeNoteId)) {
      setActiveNoteId(null);
    }
  }, [activeNoteId, capabilities.insertNotes, manuscript.annotations]);

  useEffect(() => {
    if (!capabilities.editCitations) return;
    if (activeCitationId && !manuscript.citations.some((citation) => citation.id === activeCitationId)) {
      setActiveCitationId(null);
    }
  }, [activeCitationId, capabilities.editCitations, manuscript.citations]);

  useEffect(() => {
    if (!capabilities.editCrossReferences) return;
    if (
      activeCrossReferenceId &&
      !(manuscript.crossReferences ?? []).some((reference) => reference.id === activeCrossReferenceId)
    ) {
      setActiveCrossReferenceId(null);
    }
  }, [activeCrossReferenceId, capabilities.editCrossReferences, manuscript.crossReferences]);

  const editor = useEditor({
    editable: effectiveEditable,
    extensions: [
      StarterKit.configure(
        capabilities.editStructure
          ? { horizontalRule: false }
          : { heading: false, horizontalRule: false },
      ),
      ...OMI_RICH_TEXT_EXTENSIONS,
      OmiProofreadingExtension,
      ...(capabilities.insertNotes
        ? [
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
                setIntegrationAction(null);
              },
              accessibleLabel: (attributes: OmiNoteAttributes) =>
                `${tRef.current('notes.note')} ${attributes.label}`,
            }),
          ]
        : []),
      ...(capabilities.editCitations ? [OmiCitationExtension] : []),
      ...(capabilities.editCrossReferences ? [OmiCrossReferenceExtension] : []),
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
        const target = event.target;
        if (!(target instanceof Element)) return false;

        const proofreadingIssueId = target
          .closest<HTMLElement>('[data-proofreading-issue-id]')
          ?.dataset.proofreadingIssueId;
        if (proofreadingIssueId) {
          proofreadingSelectRef.current(proofreadingIssueId);
          return true;
        }

        if (capabilities.editCrossReferences) {
          const crossReferenceId = target
            .closest<HTMLElement>('[data-omi-cross-reference][data-cross-reference-id]')
            ?.dataset.crossReferenceId;
          if (crossReferenceId) {
            setActiveCrossReferenceId(crossReferenceId);
            setActiveCitationId(null);
            setActiveNoteId(null);
            setCitationPickerOpen(false);
            setCrossReferencePickerOpen(false);
            setIntegrationAction(null);
            return true;
          }
        }

        if (capabilities.editCitations) {
          const citationId = target
            .closest<HTMLElement>('[data-omi-citation][data-citation-id]')
            ?.dataset.citationId;
          if (citationId) {
            setActiveCitationId(citationId);
            setActiveCrossReferenceId(null);
            setActiveNoteId(null);
            setCitationPickerOpen(false);
            setCrossReferencePickerOpen(false);
            setIntegrationAction(null);
            return true;
          }
        }

        if (!capabilities.insertNotes) return false;
        const noteId = target
          .closest<HTMLElement>('[data-omi-note][data-note-id]')
          ?.dataset.noteId;
        if (!noteId) return false;

        setActiveNoteId(noteId);
        setActiveCitationId(null);
        setActiveCrossReferenceId(null);
        setCitationPickerOpen(false);
        setCrossReferencePickerOpen(false);
        setIntegrationAction(null);
        return true;
      },
    },
    onUpdate: ({ editor: currentEditor }) => {
      onUpdateRef.current(blockId, JSON.stringify(currentEditor.getJSON()));
      if (capabilities.reconcileWorkspaceReferences) {
        reconcileNotesAfterBlockEdit();
        reconcileCitationsAfterBlockEdit();
        reconcileCrossReferencesAfterBlockEdit();
      }
    },
  });

  const proofreading = useEditorProofreading(
    editor,
    blockId,
    manuscriptLanguage ?? manuscript.locale,
  );
  proofreadingSelectRef.current = proofreading.selectIssue;

  useEffect(() => {
    editor?.setEditable(effectiveEditable);
  }, [effectiveEditable, editor]);

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
    if (!editor || !capabilities.editCitations) return;
    collapseSelectionToEnd();
    setCitationPickerOpen(true);
    setCrossReferencePickerOpen(false);
    setIntegrationAction(null);
    closeSecondaryEditors();
  }

  function openCrossReferencePicker(): void {
    if (!editor || !capabilities.editCrossReferences) return;
    collapseSelectionToEnd();
    setCrossReferencePickerOpen(true);
    setCitationPickerOpen(false);
    setIntegrationAction(null);
    closeSecondaryEditors();
  }

  function openIntegrationAction(action: 'translate' | 'agent'): void {
    if (!editor || !externalIntegrationsAllowed) return;
    setCitationPickerOpen(false);
    setCrossReferencePickerOpen(false);
    closeSecondaryEditors();
    setIntegrationAction(action);
  }

  function insertNote(): void {
    if (!editor || !capabilities.insertNotes) return;
    collapseSelectionToEnd();
    setCitationPickerOpen(false);
    setCrossReferencePickerOpen(false);
    setIntegrationAction(null);
    closeSecondaryEditors();
    editor.chain().focus().insertOmiNote({ noteType: 'footnote' }).insertContent(' ').run();
  }

  function insertCitationCluster(selections: CitationPickerSelection[]): void {
    if (!editor || !capabilities.editCitations || selections.length === 0) return;
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
      setIntegrationAction(null);
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
    if (!editor || !capabilities.editCrossReferences) return;
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
      setIntegrationAction(null);
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

  const showSelectionActions = effectiveEditable && (
    capabilities.editCitations ||
    capabilities.insertNotes ||
    capabilities.editCrossReferences ||
    externalIntegrationsAllowed
  );

  return (
    <article
      className={`omi-block-editor${className ? ` ${className}` : ''}`}
      data-block-id={blockId}
      id={`omi-target-${blockId}`}
      style={editorStyle}
    >
      <EditorContent editor={editor} />

      {proofreading.activeIssue ? (
        <ProofreadingSuggestionCard
          issue={proofreading.activeIssue}
          locale={locale}
          onApply={proofreading.applyReplacement}
          onIgnore={proofreading.ignoreActiveIssue}
          onClose={() => proofreading.selectIssue(null)}
        />
      ) : null}

      {effectiveEditable ? (
        <RichTextToolbar
          editor={editor}
          locale={locale}
          manuscriptLanguage={manuscriptLanguage ?? manuscript.locale}
        />
      ) : null}

      {showSelectionActions ? (
        <SelectionActionToolbar
          editor={editor}
          citationLabel={t('editor.addCitation')}
          noteLabel={t('editor.addNote')}
          crossReferenceLabel={crossReferenceCopy.insert}
          translateLabel={integrationLabels.translate}
          assistantLabel={integrationLabels.assistant}
          onCitation={capabilities.editCitations ? openCitationPicker : undefined}
          onNote={capabilities.insertNotes ? insertNote : undefined}
          onCrossReference={capabilities.editCrossReferences ? openCrossReferencePicker : undefined}
          onTranslate={externalIntegrationsAllowed ? () => openIntegrationAction('translate') : undefined}
          onAssistant={externalIntegrationsAllowed ? () => openIntegrationAction('agent') : undefined}
        />
      ) : null}

      {integrationAction && externalIntegrationsAllowed ? (
        <SelectionIntegrationDialog
          editor={editor}
          blockId={blockId}
          mode={integrationAction}
          sourceLanguage={manuscriptLanguage ?? manuscript.locale}
          onClose={() => setIntegrationAction(null)}
        />
      ) : null}

      {capabilities.editCrossReferences && crossReferencePickerOpen ? (
        <CrossReferencePicker
          onInsert={insertCrossReference}
          onCancel={() => setCrossReferencePickerOpen(false)}
        />
      ) : null}

      {capabilities.editCitations && citationPickerOpen ? (
        <CitationPicker
          onInsert={insertCitationCluster}
          onCancel={() => setCitationPickerOpen(false)}
        />
      ) : null}

      {capabilities.editCrossReferences && activeCrossReferenceId ? (
        <CrossReferenceEditorCard
          crossReferenceId={activeCrossReferenceId}
          onClose={() => setActiveCrossReferenceId(null)}
        />
      ) : null}

      {capabilities.editCitations && activeCitationId && activeCluster && activeCluster.citationIds.length > 1 ? (
        <CitationClusterEditorCard
          clusterId={activeCluster.id}
          onClose={() => setActiveCitationId(null)}
        />
      ) : capabilities.editCitations && activeCitationId ? (
        <CitationEditorCard
          citationId={activeCitationId}
          onClose={() => setActiveCitationId(null)}
        />
      ) : null}

      {capabilities.insertNotes && activeNoteId ? (
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

function getIntegrationActionLabels(locale: string): {
  translate: string;
  assistant: string;
} {
  if (locale === 'hu') return { translate: 'Fordítás', assistant: 'Asszisztens' };
  if (locale === 'de') return { translate: 'Übersetzen', assistant: 'Assistent' };
  return { translate: 'Translate', assistant: 'Assistant' };
}
