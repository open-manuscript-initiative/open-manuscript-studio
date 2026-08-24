import { Mark, mergeAttributes } from '@tiptap/core';

export interface OmiIndexMarkerAttributes {
  entryId: string;
  anchorId: string;
}

export const OmiIndexMarkerExtension = Mark.create({
  name: 'omiIndexMarker',
  inclusive: false,

  addAttributes() {
    return {
      entryId: { default: null },
      anchorId: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-omi-index-marker]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-omi-index-marker': 'true',
        'data-index-entry-id': HTMLAttributes.entryId,
        'data-index-anchor-id': HTMLAttributes.anchorId,
        class: 'omi-index-marker',
      }),
      0,
    ];
  },
});
