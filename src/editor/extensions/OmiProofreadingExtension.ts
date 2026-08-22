import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import type { ProofreadingIssue } from '../../services/proofreadingApi';

export const PROOFREADING_META = 'omiProofreading:setIssues';
const key = new PluginKey<ProofreadingIssue[]>('omiProofreading');

export const OmiProofreadingExtension = Extension.create({
  name: 'omiProofreading',
  addProseMirrorPlugins() {
    return [
      new Plugin<ProofreadingIssue[]>({
        key,
        state: {
          init: () => [],
          apply(transaction, previous) {
            const next = transaction.getMeta(PROOFREADING_META) as ProofreadingIssue[] | undefined;
            if (next) return next;
            if (transaction.docChanged) return [];
            return previous;
          },
        },
        props: {
          decorations(state) {
            const issues = key.getState(state) ?? [];
            const decorations = issues.flatMap((issue) => {
              const range = textOffsetRange(state.doc, issue.offset, issue.length);
              if (!range) return [];
              return [Decoration.inline(range.from, range.to, {
                class: `omi-proofreading-issue omi-proofreading-issue--${issue.category}`,
                'data-proofreading-issue-id': issue.id,
                'data-proofreading-category': issue.category,
              })];
            });
            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

export function textOffsetRange(
  doc: ProseMirrorNode,
  offset: number,
  length: number,
): { from: number; to: number } | null {
  const targetStart = offset;
  const targetEnd = offset + length;
  let textOffset = 0;
  let from: number | null = null;
  let to: number | null = null;

  doc.descendants((node, pos) => {
    if (!node.isText || !node.text) return true;
    const start = textOffset;
    const end = start + node.text.length;
    if (from === null && targetStart >= start && targetStart <= end) {
      from = pos + Math.min(node.text.length, targetStart - start);
    }
    if (targetEnd >= start && targetEnd <= end) {
      to = pos + Math.min(node.text.length, targetEnd - start);
    }
    textOffset = end;
    return to === null;
  });

  if (from === null || to === null || to <= from) return null;
  return { from, to };
}
