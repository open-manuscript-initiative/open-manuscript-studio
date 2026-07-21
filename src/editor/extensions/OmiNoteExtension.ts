import { mergeAttributes, Node } from '@tiptap/core';

/**
 * Egy minimális, szövegközi OMI-jegyzetcsomópont.
 *
 * A node:
 * - inline: bekezdésen belül helyezhető el;
 * - atom: egyetlen, oszthatatlan szerkezeti egység;
 * - selectable: kattintással kijelölhető;
 * - contenteditable="false": a felirata közvetlenül nem szerkeszthető.
 */
export const OmiNoteExtension = Node.create({
  name: 'omiNote',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,

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
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span.omi-note[data-note-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'omi-note',
        contenteditable: 'false',
      }),
      'Jegyzet',
    ];
  },
});
