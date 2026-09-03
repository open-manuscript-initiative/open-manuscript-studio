import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

import type {
  OmiAnnotation,
  OmiProofingChange,
  OmiPublicationCorrection,
} from '../../types/omi';

export const PROOFING_MARKS_META = 'omiProofingMarks:set';

export interface OmiPublicationFlowBreak {
  targetBlockId: string;
  textOffset: number;
  height: number;
}

export interface OmiProofingMarksPayload {
  changes: readonly OmiProofingChange[];
  comments: readonly OmiAnnotation[];
  corrections: readonly OmiPublicationCorrection[];
  pageFlowBreaks: readonly OmiPublicationFlowBreak[];
}

const emptyPayload = (): OmiProofingMarksPayload => ({
  changes: [],
  comments: [],
  corrections: [],
  pageFlowBreaks: [],
});

const key = new PluginKey<OmiProofingMarksPayload>('omiProofingMarks');

/** Visualizes portable review metadata without inserting it into editor text. */
export const OmiProofingMarksExtension = Extension.create({
  name: 'omiProofingMarks',

  addProseMirrorPlugins() {
    return [
      new Plugin<OmiProofingMarksPayload>({
        key,
        state: {
          init: emptyPayload,
          apply(transaction, previous) {
            const next = transaction.getMeta(PROOFING_MARKS_META) as
              | OmiProofingMarksPayload
              | undefined;
            return next ?? previous;
          },
        },
        props: {
          decorations(state) {
            const payload = key.getState(state) ?? emptyPayload();
            const changesByBlock = groupByBlock(
              payload.changes.filter((change) => change.status === 'pending'),
            );
            const commentsByBlock = groupByBlock(
              payload.comments.filter((comment) => (
                comment.type === 'comment' && comment.status !== 'resolved'
              )),
            );
            const correctionsByBlock = groupByBlock(payload.corrections);
            const pageFlowBreaksByBlock = groupByBlock(payload.pageFlowBreaks);
            const decorations: Decoration[] = [];

            state.doc.forEach((node, offset) => {
              const blockId = stringAttribute(node.attrs.omiBlockId);
              if (!blockId) return;
              const changes = changesByBlock.get(blockId) ?? [];
              const comments = commentsByBlock.get(blockId) ?? [];
              const nodeText = node.textBetween(0, node.content.size, '\n', '\n');
              const corrections = (correctionsByBlock.get(blockId) ?? []).filter(
                (correction) => correctionSourceMatches(nodeText, correction),
              );
              const pageFlowBreaks = pageFlowBreaksByBlock.get(blockId) ?? [];

              const nodeClasses = [
                changes.length ? 'omi-proofing-change-block' : '',
                comments.length ? 'omi-proofing-comment-block' : '',
                corrections.some((item) => item.kind === 'page-break-before')
                  ? 'omi-publication-correction-page-break'
                  : '',
                corrections.some((item) => item.kind === 'keep-together')
                  ? 'omi-publication-correction-keep-together'
                  : '',
                corrections.some((item) => item.kind === 'keep-with-next')
                  ? 'omi-publication-correction-keep-next'
                  : '',
              ].filter(Boolean).join(' ');

              if (nodeClasses) {
                decorations.push(Decoration.node(offset, offset + node.nodeSize, {
                  class: nodeClasses,
                  ...(changes[0]
                    ? { 'data-proofing-change-id': changes[0].id }
                    : {}),
                }));
              }

              for (const comment of comments) {
                const range = comment.targetRange;
                if (!range || range.to <= range.from) continue;
                const positions = textRangeInNode(node, offset, range.from, range.to);
                if (!positions) continue;
                decorations.push(Decoration.inline(positions.from, positions.to, {
                  class: 'omi-proofing-comment-range',
                  'data-proofing-comment-id': comment.id,
                }));
              }

              for (const correction of corrections) {
                addCorrectionDecoration(decorations, node, offset, correction);
              }
              for (const pageFlowBreak of pageFlowBreaks) {
                addPageFlowBreakDecoration(
                  decorations,
                  node,
                  offset,
                  pageFlowBreak,
                );
              }
            });

            return DecorationSet.create(state.doc, decorations);
          },
        },
      }),
    ];
  },
});

function addPageFlowBreakDecoration(
  decorations: Decoration[],
  node: ProseMirrorNode,
  offset: number,
  pageFlowBreak: OmiPublicationFlowBreak,
): void {
  const position = textPositionInNode(node, offset, pageFlowBreak.textOffset);
  if (position === null || pageFlowBreak.height <= 0) return;
  decorations.push(Decoration.widget(position, () => {
    const spacer = document.createElement('span');
    spacer.className = 'omi-publication-flow-break';
    spacer.dataset.publicationFlowBreak = 'true';
    spacer.style.setProperty(
      '--omi-publication-flow-break-height',
      `${Math.round(pageFlowBreak.height * 100) / 100}px`,
    );
    spacer.contentEditable = 'false';
    spacer.setAttribute('aria-hidden', 'true');
    return spacer;
  }, {
    key: `page-flow:${pageFlowBreak.targetBlockId}:${pageFlowBreak.textOffset}:${Math.round(pageFlowBreak.height * 100)}`,
    side: -1,
    ignoreSelection: true,
  }));
}

function addCorrectionDecoration(
  decorations: Decoration[],
  node: ProseMirrorNode,
  offset: number,
  correction: OmiPublicationCorrection,
): void {
  if (correction.kind === 'nonbreaking') {
    const range = textRangeInNode(
      node,
      offset,
      correction.from ?? 0,
      correction.to ?? correction.from ?? 0,
    );
    if (!range) return;
    decorations.push(Decoration.inline(range.from, range.to, {
      class: 'omi-publication-correction omi-publication-correction--nonbreaking',
      'data-publication-correction-id': correction.id,
    }));
    return;
  }

  if (
    correction.kind !== 'discretionary-hyphen'
    && correction.kind !== 'forced-line-break'
  ) return;

  const position = textPositionInNode(node, offset, correction.from ?? 0);
  if (position === null) return;
  decorations.push(Decoration.widget(position, () => {
    if (correction.kind === 'forced-line-break') {
      const marker = document.createElement('span');
      marker.className = 'omi-publication-correction omi-publication-correction--line-break';
      marker.dataset.publicationCorrectionId = correction.id;
      marker.setAttribute('aria-label', 'Forced line break');
      marker.append(document.createElement('br'));
      return marker;
    }

    const marker = document.createElement('span');
    marker.className = 'omi-publication-correction omi-publication-correction--hyphen';
    marker.dataset.publicationCorrectionId = correction.id;
    marker.setAttribute('aria-label', 'Optional hyphen');
    marker.textContent = '\u00ad';
    return marker;
  }, {
    key: correction.id,
    side: 1,
  }));
}

function textRangeInNode(
  node: ProseMirrorNode,
  nodeOffset: number,
  from: number,
  to: number,
): { from: number; to: number } | null {
  const start = textPositionInNode(node, nodeOffset, from);
  const end = textPositionInNode(node, nodeOffset, to);
  return start !== null && end !== null && end > start
    ? { from: start, to: end }
    : null;
}

function textPositionInNode(
  node: ProseMirrorNode,
  nodeOffset: number,
  target: number,
): number | null {
  let textOffset = 0;
  let resolved: number | null = null;

  node.descendants((child, relativePosition) => {
    if (resolved !== null) return false;
    if (child.isText && child.text) {
      const end = textOffset + child.text.length;
      if (target >= textOffset && target <= end) {
        resolved = nodeOffset + 1 + relativePosition + (target - textOffset);
        return false;
      }
      textOffset = end;
      return false;
    }
    if (child.type.name === 'hardBreak') {
      if (target === textOffset) {
        resolved = nodeOffset + 1 + relativePosition;
        return false;
      }
      textOffset += 1;
      return false;
    }
    return true;
  });

  if (resolved === null && target === textOffset) {
    return nodeOffset + node.nodeSize - 1;
  }
  return resolved;
}

function groupByBlock<T extends { targetBlockId: string }>(
  values: readonly T[],
): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const value of values) {
    const group = result.get(value.targetBlockId) ?? [];
    group.push(value);
    result.set(value.targetBlockId, group);
  }
  return result;
}

function stringAttribute(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function correctionSourceMatches(
  text: string,
  correction: OmiPublicationCorrection,
): boolean {
  if (!correction.sourceText) return true;
  const from = Math.max(0, Math.min(text.length, correction.from ?? 0));
  const to = Math.max(from, Math.min(text.length, correction.to ?? from));
  return text.slice(from, to) === correction.sourceText;
}
