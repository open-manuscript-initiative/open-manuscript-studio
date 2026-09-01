import { mergeAttributes, Node } from '@tiptap/core';
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from '@tiptap/react';

import { useStudioStore } from '../../app/useStudioStore';
import { VisualBlockEditor } from '../../components/VisualBlockEditor';
import { OMI_VISUAL_NODE } from '../continuousManuscriptDocument';
import {
  collectCrossReferenceTargets,
  formatCrossReferenceLabel,
} from '../../model/crossReferences';
import type { OmiBlock, OmiVisualBlockData } from '../../types/omi';

export const OmiVisualBlockExtension = Node.create({
  name: OMI_VISUAL_NODE,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      omiVisual: { default: null },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-omi-visual-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-omi-visual-block': 'true',
        contenteditable: 'false',
      }),
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ContinuousVisualBlockView);
  },
});

function ContinuousVisualBlockView({ node, selected }: NodeViewProps) {
  const manuscript = useStudioStore((state) => state.manuscript);
  const blockId = stringAttribute(node.attrs.omiBlockId);
  const location = manuscript.sections
    .map((section) => ({
      section,
      blockIndex: section.blocks.findIndex((block) => block.id === blockId),
    }))
    .find(({ blockIndex }) => blockIndex >= 0);
  const storedBlock = location?.section.blocks[location.blockIndex];
  const target = collectCrossReferenceTargets(manuscript).find(
    (candidate) => candidate.id === blockId,
  );
  const visual = storedBlock?.visual ?? node.attrs.omiVisual as OmiVisualBlockData | undefined;
  const block: OmiBlock | null = visual
    ? {
        ...(storedBlock ?? {}),
        id: blockId,
        type: stringAttribute(node.attrs.omiBlockType) || visual.kind,
        content: '',
        visual,
      }
    : null;

  return (
    <NodeViewWrapper
      className={`omi-numbered-object omi-continuous-visual omi-block-editor${selected ? ' ProseMirror-selectednode' : ''}`}
      data-block-id={blockId}
      data-cross-reference-target={target?.kind}
      id={`omi-target-${blockId}`}
      contentEditable={false}
    >
      {block?.visual && location ? (
        <>
          {target ? (
            <div className="omi-numbered-object-label">
              {formatCrossReferenceLabel(
                { targetId: target.id, displayStyle: 'label-number' },
                target,
                manuscript.locale,
              )}
            </div>
          ) : null}
          <VisualBlockEditor
            block={block as OmiBlock & { visual: OmiVisualBlockData }}
            sectionId={location.section.id}
            blockIndex={location.blockIndex}
          />
        </>
      ) : (
        <div className="omi-visual-block omi-visual-block--missing">Visual element</div>
      )}
    </NodeViewWrapper>
  );
}

function stringAttribute(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
