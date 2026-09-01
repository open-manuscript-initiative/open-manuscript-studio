import {
  findAdjacentManuscriptBlock,
  findManuscriptBlock,
  type ManuscriptBlockLocation,
} from '../model/manuscriptEditingOrder';
import { extractManuscriptState, type CreateChangeEventInput } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import type { OmiBlock, OmiManuscriptState } from '../types/omi';
import { useStudioStore } from './useStudioStore';

export interface ParagraphMergeResult {
  blockId: string;
  selectionPosition: number;
}

type ParagraphLocation = ManuscriptBlockLocation;

export function splitParagraphBlock(
  blockId: string,
  leftContent: string,
  rightContent: string,
): string | null {
  let createdBlockId: string | null = null;

  useStudioStore.setState((state) => {
    const location = findParagraphBlock(state.manuscript.sections, blockId);
    if (!location) return state;

    const { sectionIndex, blockIndex, block } = location;
    const newBlock: OmiBlock = {
      id: crypto.randomUUID(),
      type: 'paragraph',
      content: rightContent,
    };
    createdBlockId = newBlock.id;

    const nextSections = state.manuscript.sections.map((section, index) => {
      if (index !== sectionIndex) return section;
      const blocks = [...section.blocks];
      blocks.splice(
        blockIndex,
        1,
        { ...block, content: leftContent },
        newBlock,
      );
      return { ...section, blocks };
    });

    const nextState = reassignAnchoredObjects(
      {
        ...extractManuscriptState(state.manuscript),
        sections: nextSections,
      },
      blockId,
      newBlock.id,
      rightContent,
    );

    return stageStructuralChange(
      state,
      nextState,
      'Split manuscript paragraph',
      [
        {
          operation: 'block.content.set',
          targetId: blockId,
          path: `/blocks/${blockId}/content`,
          previousValue: block.content,
          nextValue: leftContent,
        },
        {
          operation: 'block.content.set',
          targetId: newBlock.id,
          path: `/blocks/${newBlock.id}/content`,
          nextValue: rightContent,
        },
      ],
    );
  });

  if (createdBlockId) checkpointStructuralChange();
  return createdBlockId;
}

export function mergeParagraphBackward(blockId: string): ParagraphMergeResult | null {
  return mergeAdjacentParagraph(blockId, 'backward');
}

export function mergeParagraphForward(blockId: string): ParagraphMergeResult | null {
  return mergeAdjacentParagraph(blockId, 'forward');
}

function mergeAdjacentParagraph(
  blockId: string,
  direction: 'backward' | 'forward',
): ParagraphMergeResult | null {
  let result: ParagraphMergeResult | null = null;

  useStudioStore.setState((state) => {
    const location = findParagraphBlock(state.manuscript.sections, blockId);
    if (!location) return state;

    const adjacentLocation = findAdjacentManuscriptBlock(
      state.manuscript.sections,
      blockId,
      direction,
    );
    if (!adjacentLocation || adjacentLocation.block.type !== 'paragraph') return state;

    const block = location.block;
    const adjacent = adjacentLocation.block;
    const first = direction === 'backward' ? adjacent : block;
    const second = direction === 'backward' ? block : adjacent;
    const survivor = first;
    const removed = second;
    const mergedContent = mergeStoredParagraphDocuments(first.content, second.content);
    const selectionPosition = paragraphDocumentEndPosition(first.content);

    const nextSections = state.manuscript.sections.map((section) => ({
      ...section,
      blocks: section.blocks
        .filter((item) => item.id !== removed.id)
        .map((item) => item.id === survivor.id
          ? { ...item, content: mergedContent }
          : item),
    }));

    const nextState = reassignAllBlockReferences(
      {
        ...extractManuscriptState(state.manuscript),
        sections: nextSections,
      },
      removed.id,
      survivor.id,
    );

    result = {
      blockId: survivor.id,
      selectionPosition,
    };

    return stageStructuralChange(
      state,
      nextState,
      'Merged adjacent manuscript paragraphs',
      [
        {
          operation: 'block.content.set',
          targetId: survivor.id,
          path: `/blocks/${survivor.id}/content`,
          previousValue: survivor.content,
          nextValue: mergedContent,
        },
        {
          operation: 'block.remove',
          targetId: removed.id,
          path: `/blocks/${removed.id}`,
          previousValue: removed,
        },
      ],
    );
  });

  if (result) checkpointStructuralChange();
  return result;
}

function stageStructuralChange(
  state: ReturnType<typeof useStudioStore.getState>,
  nextState: OmiManuscriptState,
  summary: string,
  events: CreateChangeEventInput[],
) {
  const timestamp = new Date().toISOString();
  const pendingChangeSet = stagePendingChanges(
    state.pendingChangeSet,
    {
      baseRevisionId: state.manuscript.headRevisionId,
      summary,
      events,
      timestamp,
    },
  );

  return {
    manuscript: {
      ...state.manuscript,
      ...nextState,
      updatedAt: timestamp,
    },
    pendingChangeSet,
  };
}

function checkpointStructuralChange(): void {
  useStudioStore.getState().checkpoint('manual');
}

function findParagraphBlock(
  sections: ReturnType<typeof useStudioStore.getState>['manuscript']['sections'],
  blockId: string,
): ParagraphLocation | null {
  const location = findManuscriptBlock(sections, blockId);
  return location?.block.type === 'paragraph' ? location : null;
}

function reassignAnchoredObjects(
  state: OmiManuscriptState,
  oldBlockId: string,
  newBlockId: string,
  newBlockContent: string,
): OmiManuscriptState {
  const containsAnchor = (anchorId: string | undefined) =>
    Boolean(anchorId && newBlockContent.includes(anchorId));

  return {
    ...state,
    annotations: state.annotations.map((annotation) =>
      annotation.targetBlockId === oldBlockId && containsAnchor(annotation.anchorId)
        ? { ...annotation, targetBlockId: newBlockId }
        : annotation,
    ),
    citations: state.citations.map((citation) =>
      citation.targetBlockId === oldBlockId && containsAnchor(citation.anchorId)
        ? { ...citation, targetBlockId: newBlockId }
        : citation,
    ),
    ...(state.citationClusters
      ? {
          citationClusters: state.citationClusters.map((cluster) =>
            cluster.targetBlockId === oldBlockId && containsAnchor(cluster.anchorId)
              ? { ...cluster, targetBlockId: newBlockId }
              : cluster,
          ),
        }
      : {}),
    ...(state.crossReferences
      ? {
          crossReferences: state.crossReferences.map((reference) =>
            reference.sourceBlockId === oldBlockId && containsAnchor(reference.anchorId)
              ? { ...reference, sourceBlockId: newBlockId }
              : reference,
          ),
        }
      : {}),
  };
}

function reassignAllBlockReferences(
  state: OmiManuscriptState,
  oldBlockId: string,
  newBlockId: string,
): OmiManuscriptState {
  return {
    ...state,
    annotations: state.annotations.map((annotation) =>
      annotation.targetBlockId === oldBlockId
        ? { ...annotation, targetBlockId: newBlockId }
        : annotation,
    ),
    citations: state.citations.map((citation) =>
      citation.targetBlockId === oldBlockId
        ? { ...citation, targetBlockId: newBlockId }
        : citation,
    ),
    ...(state.citationClusters
      ? {
          citationClusters: state.citationClusters.map((cluster) =>
            cluster.targetBlockId === oldBlockId
              ? { ...cluster, targetBlockId: newBlockId }
              : cluster,
          ),
        }
      : {}),
    ...(state.crossReferences
      ? {
          crossReferences: state.crossReferences.map((reference) =>
            reference.sourceBlockId === oldBlockId
              ? { ...reference, sourceBlockId: newBlockId }
              : reference,
          ),
        }
      : {}),
  };
}

function mergeStoredParagraphDocuments(first: string, second: string): string {
  const firstDoc = parseStoredDocument(first);
  const secondDoc = parseStoredDocument(second);
  if (!firstDoc || !secondDoc) {
    return `${plainText(first)}${plainText(second)}`;
  }

  const firstNodes = [...(firstDoc.content ?? [])];
  const secondNodes = [...(secondDoc.content ?? [])];
  const firstLast = firstNodes.at(-1);
  const secondFirst = secondNodes[0];

  if (firstLast?.type === 'paragraph' && secondFirst?.type === 'paragraph') {
    firstNodes[firstNodes.length - 1] = {
      ...firstLast,
      content: [
        ...(firstLast.content ?? []),
        ...(secondFirst.content ?? []),
      ],
    };
    secondNodes.shift();
  }

  return JSON.stringify({
    type: 'doc',
    content: [...firstNodes, ...secondNodes],
  });
}

function paragraphDocumentEndPosition(content: string): number {
  const doc = parseStoredDocument(content);
  if (!doc) return Math.max(1, plainText(content).length + 1);
  const contentSize = (doc.content ?? []).reduce((sum, node) => sum + jsonNodeSize(node), 0);
  return Math.max(1, contentSize - 1);
}

interface StoredNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: unknown[];
  content?: StoredNode[];
}

function parseStoredDocument(content: string): StoredNode | null {
  try {
    const parsed = JSON.parse(content) as StoredNode;
    return parsed?.type === 'doc' ? parsed : null;
  } catch {
    return null;
  }
}

function jsonNodeSize(node: StoredNode): number {
  if (node.type === 'text') return node.text?.length ?? 0;
  if (node.content?.length) {
    return 2 + node.content.reduce((sum, child) => sum + jsonNodeSize(child), 0);
  }
  return isTextBlockType(node.type) ? 2 : 1;
}

function isTextBlockType(type: string | undefined): boolean {
  return type === 'paragraph'
    || type === 'heading'
    || type === 'blockquote'
    || type === 'codeBlock';
}

function plainText(content: string): string {
  const doc = parseStoredDocument(content);
  if (!doc) return content;
  return collectText(doc);
}

function collectText(node: StoredNode): string {
  if (node.type === 'text') return node.text ?? '';
  return (node.content ?? []).map(collectText).join('');
}
