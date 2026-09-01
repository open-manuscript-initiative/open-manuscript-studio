import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import { useStudioStore } from '../../app/useStudioStore';
import {
  decorateManuscriptSelection,
  getEntireManuscriptSelection,
  readManuscriptDomSelection,
  renderManuscriptDomSelection,
  type ManuscriptSelectionRange,
} from '../manuscriptDomSelection';
import './OmiManuscriptSelection.css';

let currentSelection: ManuscriptSelectionRange | null = null;
let activeSelectionRoot: HTMLElement | null = null;

export function getCurrentManuscriptSelection(): ManuscriptSelectionRange | null {
  return currentSelection;
}

export const OmiManuscriptSelectionExtension = Extension.create({
  name: 'omiManuscriptSelection',
  priority: 1200,

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('omiManuscriptSelection'),
        props: {
          handleKeyDown: (view, event) => {
            const selectAll = (event.ctrlKey || event.metaKey)
              && !event.altKey
              && event.key.toLowerCase() === 'a';
            if (!selectAll) return false;

            const root = view.dom.closest<HTMLElement>('.omi-continuous-manuscript');
            if (!root) return false;
            const sections = useStudioStore.getState().manuscript.sections;
            const range = getEntireManuscriptSelection(sections);
            if (!range) return false;

            currentSelection = range;
            activeSelectionRoot = root;
            queueMicrotask(() => {
              renderManuscriptDomSelection(root, range);
              decorateManuscriptSelection(root, sections, range);
            });
            return true;
          },
        },
        view: (view) => {
          const root = view.dom.closest<HTMLElement>('.omi-continuous-manuscript');
          if (!root) return { destroy: () => undefined };

          let scheduled = false;
          const syncSelection = () => {
            if (scheduled) return;
            scheduled = true;
            queueMicrotask(() => {
              scheduled = false;
              const nativeSelection = window.getSelection();
              if (!nativeSelection || nativeSelection.rangeCount === 0) return;
              const anchorInside = Boolean(
                nativeSelection.anchorNode && root.contains(nativeSelection.anchorNode),
              );
              const focusInside = Boolean(
                nativeSelection.focusNode && root.contains(nativeSelection.focusNode),
              );
              if (!anchorInside && !focusInside) return;

              const sections = useStudioStore.getState().manuscript.sections;
              let range = readManuscriptDomSelection(root, sections);

              // Android/iOS browsers and WebViews implement the native
              // "Select all" action at the active contenteditable boundary.
              // Because each OMI block has its own Tiptap editing host, that
              // native action initially selects only one block. Mobile Chrome
              // does not always report exact 0..textLength DOM offsets, so the
              // recognition below compares the selected DOM text with the full
              // host text instead of requiring exact boundary offsets.
              if (range && isNativeMobileBlockSelectAll(root, range, nativeSelection)) {
                const entireRange = getEntireManuscriptSelection(sections);
                if (entireRange) {
                  range = entireRange;
                  currentSelection = range;
                  activeSelectionRoot = root;
                  renderManuscriptDomSelection(root, range);
                  decorateManuscriptSelection(root, sections, range);
                  return;
                }
              }

              currentSelection = range;
              activeSelectionRoot = range ? root : null;
              decorateManuscriptSelection(root, sections, range);
            });
          };

          document.addEventListener('selectionchange', syncSelection);
          root.addEventListener('pointerup', syncSelection, true);
          root.addEventListener('touchend', syncSelection, true);

          return {
            destroy: () => {
              document.removeEventListener('selectionchange', syncSelection);
              root.removeEventListener('pointerup', syncSelection, true);
              root.removeEventListener('touchend', syncSelection, true);
              if (activeSelectionRoot === root) {
                currentSelection = null;
                activeSelectionRoot = null;
              }
            },
          };
        },
      }),
    ];
  },
});

function isNativeMobileBlockSelectAll(
  root: HTMLElement,
  range: ManuscriptSelectionRange,
  nativeSelection: Selection,
): boolean {
  if (!isMobileSelectionEnvironment()) return false;
  if (range.start.blockId !== range.end.blockId) return false;

  const editors = Array.from(
    root.querySelectorAll<HTMLElement>('.omi-tiptap-editor[data-block-id]'),
  );
  if (editors.length < 2) return false;

  const selectedEditor = editors.find(
    (editor) => editor.dataset.blockId === range.start.blockId,
  );
  if (!selectedEditor) return false;

  const fullTextRange = document.createRange();
  fullTextRange.selectNodeContents(selectedEditor);
  const fullText = normalizeSelectionText(fullTextRange.toString());
  const selectedText = normalizeSelectionText(nativeSelection.toString());
  if (!fullText || !selectedText) return false;

  // Comparing normalized text handles Chrome Android's boundary-point quirks:
  // the native action can visually cover the complete contenteditable while
  // reporting offsets that start/end just inside its DOM boundary. Partial
  // selections still fail this equality check and are left untouched.
  return selectedText === fullText;
}

function normalizeSelectionText(value: string): string {
  return value
    .replace(/[\u200b-\u200d\ufeff]/gu, '')
    .replace(/[\u00a0\u202f\s]+/gu, ' ')
    .trim();
}

function isMobileSelectionEnvironment(): boolean {
  if (typeof navigator === 'undefined') return false;
  const userAgent = navigator.userAgent ?? '';
  if (/Android|iPhone|iPad|iPod/i.test(userAgent)) return true;
  return navigator.maxTouchPoints > 1 && typeof window !== 'undefined'
    && window.matchMedia('(pointer: coarse)').matches;
}
