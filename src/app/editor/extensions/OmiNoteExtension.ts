import {mergeAttributes, Node} from '@tiptap/core';

export interface OmiNoteAttributes {
  noteId: string;
  label: string;
}

/**
 * Szövegközi OMI-jegyzet.
 *
 * Az extension egy inline, atomi ProseMirror/Tiptap node-ot hoz létre.
 * Az atomi node egyetlen szemantikai egységként kezelhető, tehát a
 * kurzor nem lép be a belső tartalmába.
 */
export const OmiNoteExtension = Node.create({
  name: 'omiNote',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      noteId: {
        default: null,

        parseHTML: (element: HTMLElement): string | null =>
          element.getAttribute('data-note-id'),

        renderHTML: (attributes: Record<string, unknown>) => {
          const noteId = attributes.noteId;

          if (typeof noteId !== 'string' || noteId.length === 0) {
            return {};
          }

          return {
            'data-note-id': noteId,
          };
        },
      },

      label: {
        default: 'Jegyzet',

        parseHTML: (element: HTMLElement): string =>
          element.getAttribute('data-note-label') ??
          element.textContent ??
          'Jegyzet',

        renderHTML: (attributes: Record<string, unknown>) => {
          const label = attributes.label;

          if (typeof label !== 'string' || label.length === 0) {
            return {};
          }

          return {
            'data-note-label': label,
          };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span.omi-note[data-note-id]',
      },
    ];
  },

  renderHTML({HTMLAttributes, node}) {
    const label =
      typeof node.attrs.label === 'string'
        ? node.attrs.label
        : 'Jegyzet';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'omi-note',
        'data-omi-node-type': 'omi-note',
        contenteditable: 'false',
      }),
      label,
    ];
  },
});
