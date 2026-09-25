import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

import './OmiNonPrintingMarks.css';

const key = new PluginKey<DecorationSet>('omiNonPrintingMarks');

/**
 * Adds editor-only widgets for structural characters that do not otherwise
 * have a visible glyph. The widgets are always part of the editor view but CSS
 * keeps them hidden unless the device-local display preference is enabled.
 *
 * Decorations never enter manuscript JSON, revision history or exports.
 *
 * For large manuscripts, the decoration set is mapped through ordinary text
 * edits instead of rescanning the complete document on every keystroke. A full
 * rebuild is needed only when a transaction inserts paragraph or hard-break
 * structure (Enter, Shift+Enter, multiline paste, setContent, etc.).
 */
export const OmiNonPrintingMarksExtension = Extension.create({
  name: 'omiNonPrintingMarks',

  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: (_config, state) => buildNonPrintingDecorations(state.doc),
          apply: (transaction, decorations) => {
            if (!transaction.docChanged) return decorations;

            const mapped = decorations.map(transaction.mapping, transaction.doc);
            return transactionAddsNonPrintingStructure(transaction)
              ? buildNonPrintingDecorations(transaction.doc)
              : mapped;
          },
        },
        props: {
          decorations(state) {
            return key.getState(state) ?? DecorationSet.empty;
          },
        },
      }),
    ];
  },
});

function buildNonPrintingDecorations(doc: ProseMirrorNode): DecorationSet {
  const marks: Decoration[] = [];

  doc.descendants((node, position) => {
    if (node.type.name === 'hardBreak') {
      // Put ↵ immediately before the actual <br>, at the visual line end.
      marks.push(
        Decoration.widget(
          position,
          () => createNonPrintingMark('↵', 'line-break'),
          { side: -1 },
        ),
      );
    }

    if (node.isTextblock) {
      // Keep ¶ inside the closing boundary of the text block.
      marks.push(
        Decoration.widget(
          position + node.nodeSize - 1,
          () => createNonPrintingMark('¶', 'paragraph-end'),
          { side: -1 },
        ),
      );
    }
  });

  return DecorationSet.create(doc, marks);
}

function transactionAddsNonPrintingStructure(transaction: Transaction): boolean {
  return transaction.steps.some((step) => containsStructuralNode(step.toJSON()));
}

function containsStructuralNode(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some(containsStructuralNode);

  const record = value as Record<string, unknown>;
  const type = record.type;
  if (type === 'paragraph' || type === 'heading' || type === 'hardBreak') {
    return true;
  }

  return Object.values(record).some(containsStructuralNode);
}

function createNonPrintingMark(
  glyph: string,
  kind: 'line-break' | 'paragraph-end',
): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'omi-nonprinting-mark';
  mark.dataset.nonprintingMark = kind;
  mark.dataset.nonprintingGlyph = glyph;
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('contenteditable', 'false');
  return mark;
}
