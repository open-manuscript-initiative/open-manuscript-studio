import { Node, mergeAttributes } from '@tiptap/core';

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
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-note-id]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'omi-note',
      }),
      '📝',
    ];
  },
});
