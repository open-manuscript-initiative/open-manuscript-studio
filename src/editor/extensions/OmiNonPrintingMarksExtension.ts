import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import { transactionChangesNonPrintingContent } from '../nonPrintingMarkChanges';

import './OmiNonPrintingMarks.css';

const key = new PluginKey<DecorationSet>('omiNonPrintingMarks');

/**
 * Adds editor-only widgets for whitespace and structural characters. The
 * widgets are always part of the editor view but CSS keeps them hidden unless
 * the device-local display preference is enabled.
 *
 * Decorations never enter manuscript JSON, revision history or exports.
 *
 * Ordinary edits map the existing decorations. A rebuild is needed only when
 * an edit adds/removes visible whitespace or changes paragraph structure.
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
            return transactionChangesNonPrintingContent(transaction)
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
    if (node.isText) {
      const text = node.text ?? '';
      for (let offset = 0; offset < text.length; offset += 1) {
        const character = text[offset];
        const glyph = nonPrintingWhitespaceGlyph(character);
        if (!glyph) continue;

        marks.push(
          Decoration.widget(
            position + offset,
            () => createNonPrintingMark(glyph, character === '\u00a0' ? 'nonbreaking-space' : 'space'),
            { side: -1, nonPrintingWhitespace: true },
          ),
        );
      }
    }

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

function nonPrintingWhitespaceGlyph(character: string | undefined): string | null {
  if (character === ' ' || (character && /\p{Zs}/u.test(character))) {
    return character === '\u00a0' ? '⍽' : '·';
  }
  if (character === '\t') return '→';
  return null;
}

function createNonPrintingMark(
  glyph: string,
  kind: 'line-break' | 'paragraph-end' | 'space' | 'nonbreaking-space',
): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'omi-nonprinting-mark';
  mark.dataset.nonprintingMark = kind;
  mark.dataset.nonprintingGlyph = glyph;
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('contenteditable', 'false');
  return mark;
}
