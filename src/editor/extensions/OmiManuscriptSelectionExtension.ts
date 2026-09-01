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
              const range = readManuscriptDomSelection(root, sections);
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
