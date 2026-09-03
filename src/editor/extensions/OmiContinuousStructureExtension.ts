import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import {
  getTopLevelBlockAtPosition,
  OMI_VISUAL_NODE,
} from '../continuousManuscriptDocument';

const STRUCTURAL_NODE_TYPES = [
  'paragraph',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'codeBlock',
  OMI_VISUAL_NODE,
];

export const OmiContinuousStructureExtension = Extension.create({
  name: 'omiContinuousStructure',
  priority: 1100,

  addGlobalAttributes() {
    return [{
      types: STRUCTURAL_NODE_TYPES,
      attributes: {
        omiBlockId: {
          default: null,
          parseHTML: (element: HTMLElement) => element.dataset.blockId ?? null,
          renderHTML: (attributes: Record<string, unknown>) =>
            stringAttribute(attributes.omiBlockId)
              ? { 'data-block-id': stringAttribute(attributes.omiBlockId) }
              : {},
        },
        omiSectionId: {
          default: null,
          parseHTML: (element: HTMLElement) => element.dataset.sectionId ?? null,
          renderHTML: (attributes: Record<string, unknown>) =>
            stringAttribute(attributes.omiSectionId)
              ? { 'data-section-id': stringAttribute(attributes.omiSectionId) }
              : {},
        },
        omiBlockType: {
          default: null,
          parseHTML: (element: HTMLElement) => element.dataset.blockType ?? null,
          renderHTML: (attributes: Record<string, unknown>) =>
            stringAttribute(attributes.omiBlockType)
              ? { 'data-block-type': stringAttribute(attributes.omiBlockType) }
              : {},
        },
        omiAnchorId: {
          default: null,
          parseHTML: (element: HTMLElement) =>
            element.id.startsWith('omi-target-')
              ? element.id.slice('omi-target-'.length)
              : null,
          renderHTML: (attributes: Record<string, unknown>) =>
            stringAttribute(attributes.omiAnchorId)
              ? { id: `omi-target-${stringAttribute(attributes.omiAnchorId)}` }
              : {},
        },
        omiSectionNumber: {
          default: null,
          parseHTML: (element: HTMLElement) => element.dataset.sectionNumber ?? null,
          renderHTML: (attributes: Record<string, unknown>) =>
            stringAttribute(attributes.omiSectionNumber)
              ? { 'data-section-number': stringAttribute(attributes.omiSectionNumber) }
              : {},
        },
        omiParagraphStyleId: {
          default: null,
          parseHTML: (element: HTMLElement) => element.dataset.paragraphStyleId ?? null,
          renderHTML: (attributes: Record<string, unknown>) =>
            stringAttribute(attributes.omiParagraphStyleId)
              ? { 'data-paragraph-style-id': stringAttribute(attributes.omiParagraphStyleId) }
              : {},
        },
        omiNextParagraphStyleId: {
          default: null,
          parseHTML: (element: HTMLElement) => element.dataset.nextParagraphStyleId ?? null,
          renderHTML: (attributes: Record<string, unknown>) =>
            stringAttribute(attributes.omiNextParagraphStyleId)
              ? { 'data-next-paragraph-style-id': stringAttribute(attributes.omiNextParagraphStyleId) }
              : {},
        },
      },
    }];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('omiContinuousStructureNormalizer'),
        appendTransaction: (transactions, _oldState, newState) => {
          if (!transactions.some((transaction) => transaction.docChanged)) return null;

          const usedBlockIds = new Set<string>();
          const usedSectionIds = new Set<string>();
          let currentSectionId = '';
          let previousNextParagraphStyleId = '';
          let changed = false;
          const transaction = newState.tr;

          newState.doc.forEach((node, offset) => {
            const original = node.attrs as Record<string, unknown>;
            const requestedBlockId = stringAttribute(original.omiBlockId);
            const newlyCreated = !requestedBlockId || usedBlockIds.has(requestedBlockId);
            const blockId = uniqueAttribute(original.omiBlockId, usedBlockIds);
            const heading = node.type.name === 'heading';
            let sectionId = stringAttribute(original.omiSectionId);

            if (heading) {
              sectionId = uniqueAttribute(sectionId, usedSectionIds);
              currentSectionId = sectionId;
            } else if (!currentSectionId) {
              sectionId = uniqueAttribute(sectionId, usedSectionIds);
              currentSectionId = sectionId;
            } else {
              sectionId = currentSectionId;
            }

            const blockType = blockTypeForNode(node, original.omiBlockType);
            const ownNextParagraphStyleId = stringAttribute(
              original.omiNextParagraphStyleId,
            );
            const nextAttributes = {
              ...original,
              omiBlockId: blockId,
              omiSectionId: sectionId,
              omiBlockType: blockType,
              omiAnchorId: heading ? sectionId : blockId,
              omiSectionNumber: heading ? original.omiSectionNumber ?? null : null,
              omiParagraphStyleId: heading
                ? null
                : newlyCreated
                  ? ownNextParagraphStyleId || previousNextParagraphStyleId || null
                  : original.omiParagraphStyleId ?? null,
              omiNextParagraphStyleId: heading
                ? null
                : original.omiNextParagraphStyleId ?? null,
            };

            previousNextParagraphStyleId = heading ? '' : ownNextParagraphStyleId;

            if (!shallowEqual(original, nextAttributes)) {
              changed = true;
              transaction.setNodeMarkup(offset, undefined, nextAttributes, node.marks);
            }
          });

          return changed ? transaction : null;
        },
        view: (view) => {
          syncActiveStructureAttributes(view);
          return {
            update: (nextView) => syncActiveStructureAttributes(nextView),
            destroy: () => {
              view.dom.removeAttribute('data-block-id');
              view.dom.removeAttribute('data-section-id');
            },
          };
        },
      }),
    ];
  },
});

function syncActiveStructureAttributes(view: {
  state: { doc: Parameters<typeof getTopLevelBlockAtPosition>[0]; selection: { from: number } };
  dom: HTMLElement;
}): void {
  const active = getTopLevelBlockAtPosition(view.state.doc, view.state.selection.from);
  if (active) {
    view.dom.dataset.blockId = active.blockId;
    if (active.sectionId) view.dom.dataset.sectionId = active.sectionId;
    else delete view.dom.dataset.sectionId;
  } else {
    delete view.dom.dataset.blockId;
    delete view.dom.dataset.sectionId;
  }
}

function uniqueAttribute(value: unknown, used: Set<string>): string {
  const existing = stringAttribute(value);
  if (existing && !used.has(existing)) {
    used.add(existing);
    return existing;
  }

  let generated = crypto.randomUUID();
  while (used.has(generated)) generated = crypto.randomUUID();
  used.add(generated);
  return generated;
}

function blockTypeForNode(node: ProseMirrorNode, stored: unknown): string {
  if (node.type.name === OMI_VISUAL_NODE) return stringAttribute(stored) || 'figure';
  if (node.type.name === 'heading') return 'heading';
  if (node.type.name === 'blockquote') return 'quote';
  return 'paragraph';
}

function shallowEqual(
  first: Record<string, unknown>,
  second: Record<string, unknown>,
): boolean {
  const keys = new Set([...Object.keys(first), ...Object.keys(second)]);
  for (const key of keys) {
    if (first[key] !== second[key]) return false;
  }
  return true;
}

function stringAttribute(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
