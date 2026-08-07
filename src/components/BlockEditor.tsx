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
  reconcileNotesAfterBlockEdit,
  stageCreateNote,
} from '../app/noteActions';
import { useStudioStore } from '../app/useStudioStore';
import { OmiCitationExtension } from '../editor/extensions/OmiCitationExtension';
import {
  OmiNoteExtension,
  type OmiNoteAttributes,
} from '../editor/extensions/OmiNoteExtension';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/types';
import { createCitationCluster } from '../model/citationClusters';
import { renderCitationCluster } from '../model/cslRendering';
import { CitationClusterEditorCard } from './CitationClusterEditorCard';
import { CitationEditorCard } from './CitationEditorCard';
import {
  CitationPicker,
  type CitationPickerSelection,
} from './CitationPicker';
import { NoteEditorCard } from './NoteEditorCard';

interface BlockEditorProps {
  blockId: string;
  blockType: string;
  content: string;
  onUpdate: (blockId: string, content: string) => void;
}

export function BlockEditor({
  blockId,
  blockType,
  content,
  onUpdate,
}: BlockEditorProps) {
  const { t } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeCitationId, setActiveCitationId] = useState<string | null>(null);
  const [citationPickerOpen, setCitationPickerOpen] = useState(false);
  const onUpdateRef = useRef(onUpdate);
  const tRef = useRef(t);
  const blockLabel = formatBlockType(blockType, t);
  const editorStyle = {
    '--omi-editor-placeholder': JSON.stringify(
      t('editor.emptyParagraph'),
    ),
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
    if (
      activeNoteId &&
      !manuscript.annotations.some(
        (annotation) => annotation.id === activeNoteId,
      )
    ) {
      setActiveNoteId(null);
    }
  }, [activeNoteId, manuscript.annotations]);

  useEffect(() => {
    if (
      activeCitationId &&
      !manuscript.citations.some(
        (citation) => citation.id === activeCitationId,
      )
    ) {
      setActiveCitationId(null);
    }
  }, [activeCitationId, manuscript.citations]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
        codeBlock: false,
        horizontalRule: false,
      }),
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
        },
        accessibleLabel: (attributes: OmiNoteAttributes) =>
          `${tRef.current('notes.note')} ${attributes.label}`,
      }),
      OmiCitationExtension,
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
      handleClick: (_view, _pos, event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
          return false;
        }

        const citationMarker = target.closest<HTMLElement>(
          '[data-omi-citation][data-citation-id]',
        );
        const citationId = citationMarker?.dataset.citationId;

        if (citationId) {
          setActiveCitationId(citationId);
          setActiveNoteId(null);
          setCitationPickerOpen(false);
          return true;
        }

        const noteMarker = target.closest<HTMLElement>(
          '[data-omi-note][data-note-id]',
        );
        const noteId = noteMarker?.dataset.noteId;

        if (!noteId) {
          return false;
        }

        setActiveNoteId(noteId);
        setActiveCitationId(null);
        setCitationPickerOpen(false);
        return true;
      },
    },

    onUpdate: ({ editor: currentEditor }) => {
      const structuredContent = currentEditor.getJSON();

      onUpdateRef.current(
        blockId,
        JSON.stringify(structuredContent),
      );
      reconcileNotesAfterBlockEdit();
      reconcileCitationsAfterBlockEdit();
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const incomingDocument = parseStoredContent(content);
    const currentDocument = editor.getJSON();

    if (documentsAreEqual(currentDocument, incomingDocument)) {
      return;
    }

    editor.commands.setContent(incomingDocument, {
      emitUpdate: false,
    });
  }, [content, editor]);

  function insertNote(): void {
    if (!editor) {
      return;
    }

    setCitationPickerOpen(false);
    setActiveCitationId(null);

    editor
      .chain()
      .focus()
      .insertOmiNote({
        noteType: 'footnote',
      })
      .insertContent(' ')
      .run();
  }

  function insertCitationCluster(
    selections: CitationPickerSelection[],
  ): void {
    if (!editor || selections.length === 0) {
      return;
    }

    const records = manuscript.bibliographicRecords ?? [];
    const validSelections = selections.filter((selection) =>
      records.some((record) => record.id === selection.recordId),
    );

    if (validSelections.length === 0) {
      return;
    }

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

    if (!firstCitation) {
      return;
    }

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
      setActiveCitationId(firstCitation.id);
      setActiveNoteId(null);
    }
  }

  if (!editor) {
    return (
      <div
        className="omi-block-editor omi-block-editor--loading"
        aria-live="polite"
      >
        {t('editor.loading')}
      </div>
    );
  }

  return (
    <article
      className="omi-block-editor"
      data-block-id={blockId}
      style={editorStyle}
    >
      <div className="omi-block-toolbar">
        <span className="omi-block-type">
          {blockLabel}
        </span>

        <div className="omi-block-toolbar-actions">
          <button
            type="button"
            className="omi-note-insert-button"
            onClick={() => {
              setCitationPickerOpen((open) => !open);
              setActiveCitationId(null);
              setActiveNoteId(null);
            }}
            aria-label={t('editor.insertCitation')}
            title={t('editor.insertCitation')}
          >
            <span aria-hidden="true">＋</span>
            <span>{t('editor.addCitation')}</span>
          </button>

          <button
            type="button"
            className="omi-note-insert-button"
            onClick={insertNote}
            aria-label={t('editor.insertNote')}
            title={`${t('editor.insertNote')} · Ctrl/Cmd+Alt+N`}
          >
            <span aria-hidden="true">＋</span>
            <span>{t('editor.addNote')}</span>
          </button>
        </div>
      </div>

      <EditorContent editor={editor} />

      {citationPickerOpen ? (
        <CitationPicker
          onInsert={insertCitationCluster}
          onCancel={() => setCitationPickerOpen(false)}
        />
      ) : null}

      {activeCitationId && activeCluster && activeCluster.citationIds.length > 1 ? (
        <CitationClusterEditorCard
          clusterId={activeCluster.id}
          onClose={() => setActiveCitationId(null)}
        />
      ) : activeCitationId ? (
        <CitationEditorCard
          citationId={activeCitationId}
          onClose={() => setActiveCitationId(null)}
        />
      ) : null}

      {activeNoteId ? (
        <NoteEditorCard
          compact
          noteId={activeNoteId}
          onClose={() => setActiveNoteId(null)}
        />
      ) : null}
    </article>
  );
}

function parseStoredContent(content: string): JSONContent {
  if (content.trim().length === 0) {
    return createParagraphDocument('');
  }

  try {
    const parsed: unknown = JSON.parse(content);

    if (isTiptapDocument(parsed)) {
      return parsed;
    }
  } catch {
    // Legacy textarea content opens as plain paragraph text.
  }

  return createParagraphDocument(content);
}

function createParagraphDocument(text: string): JSONContent {
  if (text.length === 0) {
    return {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
        },
      ],
    };
  }

  return {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text,
          },
        ],
      },
    ],
  };
}

function isTiptapDocument(
  value: unknown,
): value is JSONContent {
  if (!isRecord(value)) {
    return false;
  }

  if (value.type !== 'doc') {
    return false;
  }

  return (
    value.content === undefined ||
    Array.isArray(value.content)
  );
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function documentsAreEqual(
  first: JSONContent,
  second: JSONContent,
): boolean {
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
