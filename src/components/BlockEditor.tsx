import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { OmiNoteExtension } from '../editor/extensions/OmiNoteExtension';
import { useEffect, useRef } from 'react';
import {
  EditorContent,
  type JSONContent,
  useEditor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import { OmiNoteExtension } from '../editor/extensions/OmiNoteExtension';

interface BlockEditorProps {
  blockId: string;
  blockType: string;
  content: string;
  onUpdate: (blockId: string, content: string) => void;
}

/**
 * Egyetlen kéziratblokk önálló Tiptap editor instance-a.
 *
 * A store jelenleg stringet tárol, ezért az editor.getJSON()
 * eredményét JSON.stringify() segítségével mentjük.
 */
export function BlockEditor({
  blockId,
  blockType,
  content,
  onUpdate,
}: BlockEditorProps) {
  /*
   * A callbacket refben tartjuk, így az editor instance-t nem kell
   * újra létrehozni akkor sem, ha a szülő komponens újrarenderelődik.
   */
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        /*
         * A PoC-ban csak tiszta bekezdésszerkesztést engedünk.
         * Nincs Word-szerű címsor-, lista- vagy kódblokk-formázás.
         */
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
        'aria-label': `${blockType} block`,
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

  /*
   * Ha a store tartalma külső okból változik meg
   * — például dokumentumbetöltés vagy visszaállítás miatt —,
   * visszatöltjük azt az editorba.
   *
   * Az emitUpdate: false megakadályozza a végtelen
   * editor → store → editor frissítési ciklust.
   */
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
        A szerkesztő betöltése…
      </div>
    );
  }

  return (
    <article
      className="omi-block-editor"
      data-block-id={blockId}
    >
      <div className="omi-block-toolbar">
        <span className="omi-block-type">
          {formatBlockType(blockType)}
        </span>

        <button
          type="button"
          className="omi-note-insert-button"
          onClick={insertTestNote}
          aria-label="Szövegközi OMI-jegyzet beszúrása"
          title="Szövegközi OMI-jegyzet beszúrása"
        >
          <span aria-hidden="true">＋</span>
          <span>Jegyzet</span>
        </button>
      </div>

      <EditorContent editor={editor} />
    </article>
  );
}

/**
 * A store-ban levő tartalmat Tiptap JSON-dokumentummá alakítja.
 *
 * Három esetet kezel:
 * 1. érvényes Tiptap JSON-string;
 * 2. korábbi textarea-alapú egyszerű szöveg;
 * 3. üres tartalom.
 */
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
    /*
     * A korábbi textarea-tartalom nem JSON.
     * Ebben az esetben egyszerű szöveges bekezdésként nyitjuk meg.
     */
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

function createNoteId(): string {
  if (
    typeof globalThis.crypto !== 'undefined' &&
    typeof globalThis.crypto.randomUUID === 'function'
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function formatBlockType(blockType: string): string {
  switch (blockType) {
    case 'paragraph':
      return 'Bekezdés';

    case 'heading':
      return 'Címsor';

    case 'quote':
      return 'Idézet';

    default:
      return blockType;
  }
}
