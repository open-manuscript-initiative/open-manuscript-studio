import { Node, mergeAttributes } from '@tiptap/core';

export interface OmiNoteAttributes {
  noteId: string;
  label: string;
  noteType: 'footnote' | 'endnote' | 'comment';
}

/**
 * Egyedi azonosítót készít a jegyzet hivatkozási pontjához.
 *
 * A crypto.randomUUID() használható böngészőben és biztonságos
 * környezetben. A tartalék ág régebbi környezetekben is működik.
 */
function createNoteId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }

  return `note-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

/**
 * HTML-attribútumból biztonságosan olvassa ki a jegyzet típusát.
 */
function parseNoteType(
  value: string | null,
): OmiNoteAttributes['noteType'] {
  if (
    value === 'footnote' ||
    value === 'endnote' ||
    value === 'comment'
  ) {
    return value;
  }

  return 'footnote';
}

/**
 * Egyedi Tiptap-parancsok TypeScript-típusai.
 */
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    omiNote: {
      /**
       * OMI-jegyzet hivatkozási pontjának beszúrása.
       *
       * Ha van kijelölt szöveg, a node a kijelölés végére kerül,
       * így a kijelölt szöveg nem törlődik.
       */
      insertOmiNote: (
        attributes?: Partial<OmiNoteAttributes>,
      ) => ReturnType;
    };
  }
}

/**
 * OMI Note Anchor
 *
 * Ez a node nem magát a teljes jegyzetszöveget tárolja, hanem annak
 * szemantikus hivatkozási pontját. A jegyzet tartalma később az OMI
 * dokumentummodell külön objektumában tárolható, amelyhez a noteId
 * kapcsolja ezt a node-ot.
 */
export const OmiNoteExtension = Node.create({
  name: 'omiNote',

  group: 'inline',

  inline: true,

  atom: true,

  selectable: true,

  draggable: false,

  /**
   * Az atom node egyetlen, nem közvetlenül szerkeszthető egységként
   * viselkedik a ProseMirror-dokumentumban.
   */
  content: '',

  addAttributes() {
    return {
      noteId: {
        default: null,

        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-note-id'),

        renderHTML: (attributes: Record<string, unknown>) => {
          if (!attributes.noteId) {
            return {};
          }

          return {
            'data-note-id': String(attributes.noteId),
          };
        },
      },

      label: {
        default: 'N',

        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-note-label') ||
          element.textContent ||
          'N',

        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-note-label': String(attributes.label || 'N'),
        }),
      },

      noteType: {
        default: 'footnote',

        parseHTML: (element: HTMLElement) =>
          parseNoteType(
            element.getAttribute('data-note-type'),
          ),

        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-note-type': String(
            attributes.noteType || 'footnote',
          ),
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-omi-note][data-note-id]',
      },
      {
        // Korábbi próbaverziók kompatibilitása.
        tag: 'span.omi-note[data-note-id]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attributes =
      node.attrs as OmiNoteAttributes;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'omi-note',
        'data-omi-note': 'true',
        'data-note-id': attributes.noteId,
        'data-note-label': attributes.label,
        'data-note-type': attributes.noteType,
        contenteditable: 'false',
        role: 'button',
        tabindex: '0',
        title: `Jegyzet: ${attributes.label}`,
        'aria-label': `Jegyzet ${attributes.label}`,
      }),
      attributes.label,
    ];
  },

  addCommands() {
    return {
      insertOmiNote:
        (attributes = {}) =>
        ({ editor, commands }) => {
          const noteId =
            attributes.noteId?.trim() || createNoteId();

          const label =
            attributes.label?.trim() || 'N';

          const noteType =
            attributes.noteType || 'footnote';

          const { from, to, empty } =
            editor.state.selection;

          const noteNode = {
            type: this.name,
            attrs: {
              noteId,
              label,
              noteType,
            },
          };

          /*
           * Üres kijelölésnél a kurzor helyére illesztjük.
           * Szövegkijelölésnél a kijelölt tartalom után, hogy a
           * kijelölt szöveg megmaradjon.
           */
          if (empty) {
            return commands.insertContent(noteNode);
          }

          return commands.insertContentAt(to, noteNode, {
            updateSelection: true,
          });
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      /**
       * Ctrl+Alt+N / Cmd+Alt+N:
       * új jegyzethivatkozás beszúrása.
       */
      'Mod-Alt-n': () =>
        this.editor.commands.insertOmiNote(),
    };
  },
});

export default OmiNoteExtension;
