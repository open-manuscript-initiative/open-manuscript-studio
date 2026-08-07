import {
  useEffect,
  useRef,
  type CSSProperties,
} from 'react';
import {
  EditorContent,
  type JSONContent,
  useEditor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { OmiNoteExtension } from '../editor/extensions/OmiNoteExtension';
import { useTranslation } from '../i18n';
import type { TranslationKey } from '../i18n/types';

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
  const onUpdateRef = useRef(onUpdate);
  const blockLabel = formatBlockType(blockType, t);
  const editorStyle = {
    '--omi-editor-placeholder': JSON.stringify(
      t('editor.emptyParagraph'),
    ),
  } as CSSProperties;

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

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
      OmiNoteExtension,
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
    },

    onUpdate: ({ editor: currentEditor }) => {
      const structuredContent = currentEditor.getJSON();

      onUpdateRef.current(
        blockId,
        JSON.stringify(structuredContent),
      );
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

    editor
      .chain()
      .focus()
      .insertOmiNote({
        label: 'N',
        noteType: 'footnote',
      })
      .insertContent(' ')
      .run();
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

        <button
          type="button"
          className="omi-note-insert-button"
          onClick={insertNote}
          aria-label={t('editor.insertNote')}
          title={t('editor.insertNote')}
        >
          <span aria-hidden="true">＋</span>
          <span>{t('editor.addNote')}</span>
        </button>
      </div>

      <EditorContent editor={editor} />
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
