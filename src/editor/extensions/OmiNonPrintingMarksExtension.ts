import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import './OmiNonPrintingMarks.css';

const key = new PluginKey('omiNonPrintingMarks');

/**
 * Adds editor-only widgets for structural characters that do not otherwise
 * have a visible glyph. The widgets are always present in the ProseMirror view
 * but CSS keeps them hidden unless the device-local display preference is on.
 *
 * These decorations never enter the manuscript JSON, revision history or any
 * export format.
 */
export const OmiNonPrintingMarksExtension = Extension.create({
  name: 'omiNonPrintingMarks',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key,
        props: {
          decorations(state) {
            const marks: Decoration[] = [];

            state.doc.descendants((node, position) => {
              if (node.type.name === 'hardBreak') {
                // Put the marker immediately before the actual <br>, so ↵ sits
                // at the visual end of the line instead of at the next line.
                marks.push(
                  Decoration.widget(
                    position,
                    () => createNonPrintingMark('↵', 'line-break'),
                    { side: -1 },
                  ),
                );
              }

              if (node.isTextblock) {
                // Position inside the closing boundary of the text block.
                marks.push(
                  Decoration.widget(
                    position + node.nodeSize - 1,
                    () => createNonPrintingMark('¶', 'paragraph-end'),
                    { side: -1 },
                  ),
                );
              }
            });

            return DecorationSet.create(state.doc, marks);
          },
        },
      }),
    ];
  },
});

function createNonPrintingMark(
  glyph: string,
  kind: 'line-break' | 'paragraph-end',
): HTMLElement {
  const mark = document.createElement('span');
  mark.className = 'omi-nonprinting-mark';
  mark.dataset.nonprintingMark = kind;
  mark.textContent = glyph;
  mark.setAttribute('aria-hidden', 'true');
  mark.setAttribute('contenteditable', 'false');
  return mark;
}
