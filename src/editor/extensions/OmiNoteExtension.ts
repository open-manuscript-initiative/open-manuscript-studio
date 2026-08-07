import { Node, mergeAttributes } from '@tiptap/core';

export interface OmiNoteAttributes {
  noteId: string;
  anchorId: string;
  label: string;
  noteType: 'footnote' | 'endnote' | 'author-note';
}

export interface OmiNoteOptions {
  onNoteInserted?: (attributes: OmiNoteAttributes) => void;
  accessibleLabel?: (attributes: OmiNoteAttributes) => string;
}

function createStableId(prefix: string): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function parseNoteType(
  value: string | null,
): OmiNoteAttributes['noteType'] {
  if (
    value === 'footnote' ||
    value === 'endnote' ||
    value === 'author-note'
  ) {
    return value;
  }

  return 'footnote';
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    omiNote: {
      /**
       * Inserts a stable inline reference to an independent OMI annotation.
       * Selected text is preserved; the note anchor is inserted after it.
       */
      insertOmiNote: (
        attributes?: Partial<OmiNoteAttributes>,
      ) => ReturnType;
    };
  }
}

/**
 * OMI note anchor.
 *
 * The node stores only the stable inline reference. The note body and its
 * scholarly metadata live independently in manuscript.annotations.
 */
export const OmiNoteExtension = Node.create<OmiNoteOptions>({
  name: 'omiNote',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  content: '',

  addOptions() {
    return {
      onNoteInserted: undefined,
      accessibleLabel: undefined,
    };
  },

  addAttributes() {
    return {
      noteId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-note-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.noteId
            ? { 'data-note-id': String(attributes.noteId) }
            : {},
      },

      anchorId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-anchor-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.anchorId
            ? { 'data-anchor-id': String(attributes.anchorId) }
            : {},
      },

      label: {
        default: '?',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-note-label') ||
          element.textContent ||
          '?',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-note-label': String(attributes.label || '?'),
        }),
      },

      noteType: {
        default: 'footnote',
        parseHTML: (element: HTMLElement) =>
          parseNoteType(element.getAttribute('data-note-type')),
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-note-type': String(attributes.noteType || 'footnote'),
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-omi-note][data-note-id]' },
      { tag: 'span.omi-note[data-note-id]' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attributes = node.attrs as OmiNoteAttributes;
    const accessibleLabel =
      this.options.accessibleLabel?.(attributes) ??
      `Note ${attributes.label}`;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'omi-note',
        'data-omi-note': 'true',
        'data-note-id': attributes.noteId,
        'data-anchor-id': attributes.anchorId,
        'data-note-label': attributes.label,
        'data-note-type': attributes.noteType,
        contenteditable: 'false',
        role: 'button',
        tabindex: '0',
        title: accessibleLabel,
        'aria-label': accessibleLabel,
      }),
      attributes.label,
    ];
  },

  addCommands() {
    return {
      insertOmiNote:
        (attributes = {}) =>
        ({ editor, commands }) => {
          const noteAttributes: OmiNoteAttributes = {
            noteId:
              attributes.noteId?.trim() || createStableId('note'),
            anchorId:
              attributes.anchorId?.trim() || createStableId('anchor'),
            label: attributes.label?.trim() || '?',
            noteType: attributes.noteType || 'footnote',
          };
          const { to, empty } = editor.state.selection;
          const noteNode = {
            type: this.name,
            attrs: noteAttributes,
          };
          const inserted = empty
            ? commands.insertContent(noteNode)
            : commands.insertContentAt(to, noteNode, {
                updateSelection: true,
              });

          if (inserted) {
            this.options.onNoteInserted?.(noteAttributes);
          }

          return inserted;
        },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Mod-Alt-n': () =>
        this.editor.commands.insertOmiNote({
          noteType: 'footnote',
        }),
    };
  },
});

export default OmiNoteExtension;
