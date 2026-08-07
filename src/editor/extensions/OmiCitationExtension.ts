import { Node, mergeAttributes } from '@tiptap/core';

export interface OmiCitationAttributes {
  citationId: string;
  anchorId: string;
  label: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    omiCitation: {
      /** Insert a stable inline reference to an independent citation object. */
      insertOmiCitation: (
        attributes: OmiCitationAttributes,
      ) => ReturnType;
    };
  }
}

/**
 * Inline OMI citation anchor.
 *
 * Only occurrence identity, anchor identity and a derived display label are
 * stored in Tiptap content. Bibliographic metadata and locators live in the
 * manuscript citation/reference objects.
 */
export const OmiCitationExtension = Node.create({
  name: 'omiCitation',

  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  content: '',

  addAttributes() {
    return {
      citationId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-citation-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.citationId
            ? { 'data-citation-id': String(attributes.citationId) }
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
        default: '[citation]',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-citation-label') ||
          element.textContent ||
          '[citation]',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-citation-label': String(attributes.label || '[citation]'),
        }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'span[data-omi-citation][data-citation-id]' },
      { tag: 'span.omi-citation[data-citation-id]' },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attributes = node.attrs as OmiCitationAttributes;

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: 'omi-citation',
        'data-omi-citation': 'true',
        'data-citation-id': attributes.citationId,
        'data-anchor-id': attributes.anchorId,
        'data-citation-label': attributes.label,
        contenteditable: 'false',
        role: 'button',
        tabindex: '0',
        title: attributes.label,
        'aria-label': attributes.label,
      }),
      attributes.label,
    ];
  },

  addCommands() {
    return {
      insertOmiCitation:
        (attributes) =>
        ({ editor, commands }) => {
          const node = {
            type: this.name,
            attrs: attributes,
          };
          const { to, empty } = editor.state.selection;

          return empty
            ? commands.insertContent(node)
            : commands.insertContentAt(to, node, {
                updateSelection: true,
              });
        },
    };
  },
});

export default OmiCitationExtension;
