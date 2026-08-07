import { Node, mergeAttributes } from '@tiptap/core';

export interface OmiCitationAttributes {
  /** First citation ID retained for backward-compatible marker lookup. */
  citationId: string;
  /** Ordered semantic citation occurrences rendered at this anchor. */
  citationIds?: string[];
  clusterId?: string;
  anchorId: string;
  label: string;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    omiCitation: {
      /** Insert a stable inline reference to one citation or citation cluster. */
      insertOmiCitation: (
        attributes: OmiCitationAttributes,
      ) => ReturnType;
    };
  }
}

/**
 * Inline OMI citation anchor.
 *
 * Only occurrence/cluster identity, anchor identity and a derived display label
 * are stored in Tiptap content. Bibliographic metadata and locators live in
 * the manuscript citation/reference objects.
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
      citationIds: {
        default: null,
        parseHTML: (element: HTMLElement) => {
          const raw = element.getAttribute('data-citation-ids');
          if (!raw) return null;

          try {
            const parsed: unknown = JSON.parse(raw);
            return Array.isArray(parsed)
              ? parsed.filter((value): value is string => typeof value === 'string')
              : null;
          } catch {
            return raw.split(',').map((value) => value.trim()).filter(Boolean);
          }
        },
        renderHTML: (attributes: Record<string, unknown>) =>
          Array.isArray(attributes.citationIds) && attributes.citationIds.length
            ? { 'data-citation-ids': JSON.stringify(attributes.citationIds) }
            : {},
      },
      clusterId: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-cluster-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          attributes.clusterId
            ? { 'data-cluster-id': String(attributes.clusterId) }
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
    const citationIds = Array.isArray(attributes.citationIds) && attributes.citationIds.length
      ? attributes.citationIds
      : [attributes.citationId];

    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        class: citationIds.length > 1
          ? 'omi-citation omi-citation--cluster'
          : 'omi-citation',
        'data-omi-citation': 'true',
        'data-citation-id': attributes.citationId,
        'data-citation-ids': JSON.stringify(citationIds),
        'data-cluster-id': attributes.clusterId,
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
            attrs: {
              ...attributes,
              citationIds:
                attributes.citationIds?.length
                  ? attributes.citationIds
                  : [attributes.citationId],
            },
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
