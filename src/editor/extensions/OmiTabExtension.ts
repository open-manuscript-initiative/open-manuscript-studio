import { mergeAttributes, Node } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

import { nextTabStopMm } from '../../model/sectionLayout';

const PIXELS_PER_MM = 96 / 25.4;

export const OmiTabExtension = Node.create({
  name: 'omiTab',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: false,

  parseHTML() {
    return [{ tag: 'span[data-omi-tab]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-omi-tab': 'true',
        'aria-hidden': 'true',
        contenteditable: 'false',
        class: 'omi-tab-node',
      }),
    ];
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('omiTabLayout'),
        view: (view) => {
          let frame = 0;
          const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(() => layoutTabNodes(view.dom));
          };

          const resizeObserver = typeof ResizeObserver === 'undefined'
            ? null
            : new ResizeObserver(schedule);
          resizeObserver?.observe(view.dom);

          const mutationObserver = typeof MutationObserver === 'undefined'
            ? null
            : new MutationObserver(schedule);
          const layoutHost = view.dom.closest('.publication-html-section-editor')
            ?? view.dom.parentElement;
          if (layoutHost) {
            mutationObserver?.observe(layoutHost, {
              attributes: true,
              attributeFilter: ['style', 'data-publication-columns'],
              subtree: false,
            });
          }

          window.addEventListener('resize', schedule);
          schedule();

          return {
            update: schedule,
            destroy: () => {
              cancelAnimationFrame(frame);
              resizeObserver?.disconnect();
              mutationObserver?.disconnect();
              window.removeEventListener('resize', schedule);
            },
          };
        },
      }),
    ];
  },
});

function layoutTabNodes(root: HTMLElement): void {
  const rootRect = root.getBoundingClientRect();
  if (rootRect.width <= 0) return;

  const rootStyle = getComputedStyle(root);
  const columnCount = positiveInteger(rootStyle.columnCount, 1);
  const columnGap = finiteCssPixels(rootStyle.columnGap, 0);
  const columnWidth = Math.max(
    1,
    (rootRect.width - columnGap * Math.max(0, columnCount - 1)) / columnCount,
  );
  const columnStride = columnWidth + columnGap;

  for (const tab of root.querySelectorAll<HTMLElement>('[data-omi-tab]')) {
    const block = tab.closest<HTMLElement>('[data-tab-stops-mm]');
    const stops = parseTabStops(block?.dataset.tabStopsMm);
    const tabRect = tab.getBoundingClientRect();
    const rootX = Math.max(0, tabRect.left - rootRect.left);
    const columnIndex = Math.max(
      0,
      Math.min(columnCount - 1, Math.floor(rootX / Math.max(1, columnStride))),
    );
    const columnX = Math.max(0, rootX - columnIndex * columnStride);
    const currentMm = columnX / PIXELS_PER_MM;
    const targetMm = nextTabStopMm(stops, currentMm);
    const targetPx = targetMm * PIXELS_PER_MM;
    const remaining = Math.max(2, columnWidth - columnX);
    const width = Math.max(2, Math.min(remaining, targetPx - columnX));

    tab.style.width = `${width}px`;
  }
}

function parseTabStops(value: string | undefined): number[] {
  if (!value?.trim()) return [];
  return value
    .trim()
    .split(/\s+/)
    .map(Number)
    .filter((item) => Number.isFinite(item) && item > 0);
}

function positiveInteger(value: string, fallback: number): number {
  const numeric = Number.parseInt(value, 10);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : fallback;
}

function finiteCssPixels(value: string, fallback: number): number {
  const numeric = Number.parseFloat(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}
