import {useEffect, useMemo, useRef} from 'react';
import {
  EditorContent,
  type JSONContent,
  useEditor,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';

import {OmiNoteExtension} from '../editor/extensions/OmiNoteExtension';

interface BlockEditorProps {
  blockId: string;
  blockType: string;
  content: string;
  onUpdate: (blockId: string, content: string) => void;
}

/**
 * Egyetlen OMI-blokkhoz tartozó önálló Tiptap editor instance.
 */
export function BlockEditor({
  blockId,
  blockType,
  content,
  onUpdate,
}: BlockEditorProps) {
  /*
   * Az aktuális callbacket refben tartjuk, hogy a Zustand store
   * callbackjének változása ne kényszerítse az editor instance
   * újralétrehozását.
   */
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const initialContent = useMemo(
    () => parseStoredContent(content),
    [blockId],
  );

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        /*
         * Az OMI szerkesztőben egy blokk alapvetően bekezdés.
         * A Word-szerű blokkformázási lehetőségeket ezért már
         * séma szintjén is letiltjuk.
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

    content: initialContent,

    editorProps: {
      attributes: {
        class: 'block-editor',
        'data-block-id': blockId,
        'data-block-type': blockType,
        'aria-label': `${blockType} block`,
        spellcheck: 'true',
      },
    },

    onUpdate: ({editor: currentEditor}) => {
      const documentJson = currentEditor.getJSON();

      /*
       * A jelenlegi store stringet vár, ezért a strukturált
       * Tiptap JSON-t stringként mentjük.
       */
      onUpdateRef.current(
        blockId,
        JSON.stringify(documentJson),
      );
    },
  });

  /*
   * Külső állapotváltozás kezelése.
   *
   * Erre például dokumentum betöltése, visszaállítás vagy
   * távoli szinkronizáció során lehet szükség. Az emitUpdate:
   * false megakadályozza, hogy a visszatöltés újabb store-írást
   * váltson ki.
   */
  useEffect(() => {
    if (!editor) {
      return;
    }

    const incomingContent = parseStoredContent(content);

    if (documentsAreEqual(editor.getJSON(), incomingContent)) {
      return;
    }

    editor.commands.setContent(incomingContent, {
      emitUpdate: false,
    });
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return <EditorContent editor={editor} />;
}

/**
 * Feldolgozza a store-ban található blokk tartalmát.
 *
 * Támogatott:
 * 1. Tiptap JSON string;
 * 2. korábbi, textarea-ból származó egyszerű szöveg;
 * 3. üres tartalom.
 */
function parseStoredContent(content: string): JSONContent {
  const normalizedContent = content.trim();

  if (normalizedContent.length === 0) {
    return createTextDocument('');
  }

  try {
    const parsed: unknown = JSON.parse(normalizedContent);

    if (isTiptapDocument(parsed)) {
      return parsed;
    }
  } catch {
    /*
     * A tartalom nem JSON. Ez normális a korábbi, textarea-alapú
     * dokumentumoknál, ezért egyszerű szövegként migráljuk.
     */
  }

  return createTextDocument(content);
}

function createTextDocument(text: string): JSONContent {
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

  return (
    value.type === 'doc' &&
    (
      value.content === undefined ||
      Array.isArray(value.content)
    )
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
