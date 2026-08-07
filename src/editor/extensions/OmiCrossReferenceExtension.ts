import { Node, mergeAttributes } from '@tiptap/core';

export interface OmiCrossReferenceAttributes {
  crossReferenceId: string;
  anchorId: string;
  label: string;
  unresolved?: boolean;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    omiCrossReference: {
      insertOmiCrossReference: (
        attributes: OmiCrossReferenceAttributes,
      ) => ReturnType;
    };
  }
}

/**
 * Atomic inline marker for a semantic internal reference.
 *
 * Only stable reference/anchor identity and a derived display label live in
 * Tiptap. The authoritative target ID lives in manuscript.crossReferences.
 */
export const OmiCrossReferenceExtension = Node.create({
  name: 'omiCrossReference',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  draggable: false,
  content: '',

  addAttributes() {
    return {
      crossReferenceId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-cross-reference-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.crossReferenceId
            ? {
                'data-cross-reference-id': String(
                  attributes.crossReferenceId,
                ),
              }
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
        default: '[reference]',
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-cross-reference-label') ||
          element.textContent ||
          '[reference]',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-cross-reference-label': String(
            attributes.label || '[reference]',
          ),
        }),
      },
      unresolved: {
        default: false,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-cross-reference-unresolved') === 'true',
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.unresolved
            ? { 'data-cross-reference-unresolved': 'true' }
            : {},
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-omi-cross-reference][data-cross-reference-id]',
      },
      {
        tag: 'span.omi-cross-reference[data-cross-reference-id]',
      },
    ];
  },

  renderHTML({ node, HTMLAttributes }) {
    const attributes = node.attrs as OmiCrossReferenceAttributes;
    const className = attributes.unresolved
      ? 'omi-cross-reference omi-cross-reference--unresolved'
      : 'omi-cross-reference';

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: className,
        'data-omi-cross-reference': 'true',
        'data-cross-reference-id': attributes.crossReferenceId,
        'data-anchor-id': attributes.anchorId,
        'data-cross-reference-label': attributes.label,
        'data-cross-reference-unresolved': attributes.unresolved
          ? 'true'
          : undefined,
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
      insertOmiCrossReference:
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

export default OmiCrossReferenceExtension;
