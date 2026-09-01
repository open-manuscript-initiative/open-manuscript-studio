import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';

import {
  mergeParagraphBackward,
  mergeParagraphForward,
  splitParagraphBlock,
} from '../../app/paragraphBlockActions';
import { requestBlockEditorFocus } from '../blockFocusRegistry';

/**
 * Bridge native editor input to manuscript-level OMI structural operations.
 *
 * Desktop keyboards usually expose paragraph-boundary edits through keydown,
 * while Android/iOS IMEs commonly emit beforeinput instead. Both paths must
 * resolve to the same OMI split/merge operations so section/block structure
 * remains canonical without making structural boundaries feel like editor
 * barriers.
 */
export const OmiManuscriptBoundaryEditingExtension = Extension.create({
  name: 'omiManuscriptBoundaryEditing',
  priority: 1100,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('omiManuscriptBoundaryEditing'),
        props: {
          handleKeyDown: (view, event) => {
            if (event.isComposing || event.altKey || event.ctrlKey || event.metaKey) {
              return false;
            }
            if (event.key === 'Enter' && !event.shiftKey) {
              return splitAtSelection(view);
            }
            if (event.key === 'Backspace') {
              return mergeAtBoundary(view, 'backward');
            }
            if (event.key === 'Delete') {
              return mergeAtBoundary(view, 'forward');
            }
            return false;
          },
          handleDOMEvents: {
            beforeinput: (view, rawEvent) => {
              const event = rawEvent as InputEvent;
              if (event.isComposing) return false;

              let handled = false;
              if (event.inputType === 'deleteContentBackward') {
                handled = mergeAtBoundary(view, 'backward');
              } else if (event.inputType === 'deleteContentForward') {
                handled = mergeAtBoundary(view, 'forward');
              } else if (event.inputType === 'insertParagraph') {
                handled = splitAtSelection(view);
              }

              if (handled) event.preventDefault();
              return handled;
            },
          },
        },
      }),
    ];
  },
});

function editorBlock(view: EditorView): { blockId: string; blockType: string } | null {
  if (!(view.dom instanceof HTMLElement)) return null;
  const blockId = view.dom.dataset.blockId;
  const blockType = view.dom.dataset.blockType;
  if (!blockId || !blockType) return null;
  return { blockId, blockType };
}

function splitAtSelection(view: EditorView): boolean {
  const block = editorBlock(view);
  if (!block || block.blockType !== 'paragraph') return false;

  const { selection, doc } = view.state;
  if (!selection.empty) return false;

  const splitPosition = selection.from;
  const left = doc.cut(0, splitPosition);
  const right = doc.cut(splitPosition, doc.content.size);
  const newBlockId = splitParagraphBlock(
    block.blockId,
    JSON.stringify(left.toJSON()),
    JSON.stringify(right.toJSON()),
  );
  if (!newBlockId) return false;

  requestBlockEditorFocus(newBlockId, 'start');
  return true;
}

function mergeAtBoundary(
  view: EditorView,
  direction: 'backward' | 'forward',
): boolean {
  const block = editorBlock(view);
  if (!block || block.blockType !== 'paragraph') return false;

  const { selection, doc } = view.state;
  if (!selection.empty) return false;

  // In a ProseMirror doc the first editable text position is 1 and the last
  // editable text position is doc.content.size - 1. This remains stable for
  // empty paragraphs and avoids relying on depth/index internals that vary with
  // the document's child-node shape.
  const atBoundary = direction === 'backward'
    ? selection.from <= 1
    : selection.to >= Math.max(1, doc.content.size - 1);
  if (!atBoundary) return false;

  const merge = direction === 'backward'
    ? mergeParagraphBackward(block.blockId)
    : mergeParagraphForward(block.blockId);
  if (!merge) return false;

  requestBlockEditorFocus(merge.blockId, merge.selectionPosition);
  return true;
}
