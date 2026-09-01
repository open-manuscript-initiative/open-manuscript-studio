import type { JSONContent } from '@tiptap/core';

import { getSectionDepth, withParentSectionId } from '../model/sectionStructure';
import { isVisualBlock } from '../model/visualBlocks';
import type { OmiBlock, OmiSection, OmiVisualBlockData } from '../types/omi';

export const OMI_VISUAL_NODE = 'omiVisualBlock';

export interface ContinuousNodeAttributes {
  omiBlockId?: string | null;
  omiSectionId?: string | null;
  omiBlockType?: string | null;
  omiAnchorId?: string | null;
  omiSectionNumber?: string | null;
  omiVisual?: OmiVisualBlockData | null;
}

export interface ProjectContinuousDocumentOptions {
  createId?: () => string;
}

/**
 * Builds one ProseMirror document for the complete manuscript body. OMI block
 * and section identifiers travel as node attributes, but they do not create
 * independent editing hosts: browser selection and editing therefore remain
 * native across every paragraph and heading boundary.
 */
export function buildContinuousManuscriptDocument(
  sections: readonly OmiSection[],
  sectionNumbers: ReadonlyMap<string, string> = new Map(),
): JSONContent {
  const content: JSONContent[] = [];

  for (const section of sections) {
    const depth = Math.max(0, Math.min(5, getSectionDepth(sections, section.id)));
    const firstBlock = section.blocks[0];
    const hasHeading = firstBlock?.type === 'heading';

    if (!hasHeading && section.title) {
      content.push({
        type: 'heading',
        attrs: structuralAttributes({
          omiBlockId: `${section.id}--heading`,
          omiSectionId: section.id,
          omiBlockType: 'heading',
          omiAnchorId: section.id,
          omiSectionNumber: sectionNumbers.get(section.id) ?? null,
          level: depth + 1,
        }),
        content: [{ type: 'text', text: section.title }],
      });
    }

    section.blocks.forEach((block) => {
      if (isVisualBlock(block)) {
        content.push({
          type: OMI_VISUAL_NODE,
          attrs: structuralAttributes({
            omiBlockId: block.id,
            omiSectionId: section.id,
            omiBlockType: block.type,
            omiAnchorId: block.id,
            omiVisual: block.visual,
          }),
        });
        return;
      }

      const storedNodes = readStoredBlockNodes(block);
      storedNodes.forEach((storedNode, nodeIndex) => {
        const blockId = nodeIndex === 0 ? block.id : `${block.id}--part-${nodeIndex + 1}`;
        const heading = storedNode.type === 'heading';
        const node = cloneJson(storedNode);
        node.attrs = structuralAttributes({
          ...(node.attrs ?? {}),
          omiBlockId: blockId,
          omiSectionId: section.id,
          omiBlockType: nodeIndex === 0 ? block.type : blockTypeForNode(node),
          omiAnchorId: heading ? section.id : blockId,
          omiSectionNumber: heading ? sectionNumbers.get(section.id) ?? null : null,
        });
        content.push(node);
      });
    });
  }

  return {
    type: 'doc',
    content: content.length > 0 ? content : [{ type: 'paragraph' }],
  };
}

/**
 * Projects the live editor tree back into OMI. Headings define sections and
 * their levels define the parent hierarchy; all other nodes belong to the
 * preceding heading. Existing identifiers and block metadata are retained
 * whenever possible, while newly split/created nodes receive stable IDs.
 */
export function projectContinuousManuscriptDocument(
  document: JSONContent,
  previousSections: readonly OmiSection[],
  options: ProjectContinuousDocumentOptions = {},
): OmiSection[] {
  const createId = options.createId ?? (() => crypto.randomUUID());
  const previousBlocks = new Map<string, OmiBlock>();
  for (const section of previousSections) {
    for (const block of section.blocks) previousBlocks.set(block.id, block);
  }

  const usedBlockIds = new Set<string>();
  const usedSectionIds = new Set<string>();
  const sections: OmiSection[] = [];
  const headingStack: Array<{ id: string; level: number }> = [];
  let currentSection: OmiSection | null = null;

  const uniqueId = (candidate: unknown, used: Set<string>) => {
    const normalized = typeof candidate === 'string' && candidate.trim()
      ? candidate.trim()
      : '';
    if (normalized && !used.has(normalized)) {
      used.add(normalized);
      return normalized;
    }
    let generated = createId();
    while (!generated || used.has(generated)) generated = createId();
    used.add(generated);
    return generated;
  };

  for (const editorNode of document.content ?? []) {
    const attrs = (editorNode.attrs ?? {}) as ContinuousNodeAttributes & {
      level?: number;
    };
    const blockId = uniqueId(attrs.omiBlockId, usedBlockIds);

    if (editorNode.type === 'heading') {
      const sectionId = uniqueId(attrs.omiSectionId, usedSectionIds);
      const level = clampHeadingLevel(attrs.level);
      while (headingStack.length && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }
      const parentSectionId = headingStack[headingStack.length - 1]?.id;
      const previousSection = previousSections.find((section) => section.id === sectionId);
      const headingBlock = textBlockFromNode(
        editorNode,
        blockId,
        previousBlocks.get(blockId),
        'heading',
      );
      currentSection = withParentSectionId(
        {
          ...(previousSection ?? {}),
          id: sectionId,
          title: textFromNode(editorNode),
          blocks: [headingBlock],
        },
        parentSectionId,
      );
      sections.push(currentSection);
      headingStack.push({ id: sectionId, level });
      continue;
    }

    if (!currentSection) {
      const sectionId = uniqueId(attrs.omiSectionId, usedSectionIds);
      const previousSection = previousSections.find((section) => section.id === sectionId);
      currentSection = withParentSectionId(
        {
          ...(previousSection ?? {}),
          id: sectionId,
          title: '',
          blocks: [],
        },
        undefined,
      );
      sections.push(currentSection);
    }

    const block = editorNode.type === OMI_VISUAL_NODE
      ? visualBlockFromNode(editorNode, blockId, previousBlocks.get(blockId))
      : textBlockFromNode(
          editorNode,
          blockId,
          previousBlocks.get(blockId),
          blockTypeForNode(editorNode),
        );
    currentSection.blocks.push(block);
  }

  return sections;
}

export function getTopLevelBlockAtPosition(
  document: { childCount: number; child: (index: number) => { nodeSize: number; attrs: Record<string, unknown> } },
  position: number,
): { blockId: string; sectionId?: string; start: number; end: number } | null {
  let offset = 0;
  for (let index = 0; index < document.childCount; index += 1) {
    const node = document.child(index);
    const start = offset + 1;
    const end = offset + node.nodeSize - 1;
    if (position >= offset && position <= offset + node.nodeSize) {
      const blockId = stringAttribute(node.attrs.omiBlockId);
      if (!blockId) return null;
      return {
        blockId,
        sectionId: stringAttribute(node.attrs.omiSectionId) || undefined,
        start,
        end,
      };
    }
    offset += node.nodeSize;
  }
  return null;
}

export function stripContinuousAttributes(node: JSONContent): JSONContent {
  const next = cloneJson(node);
  if (next.attrs) {
    const attrs = { ...next.attrs };
    delete attrs.omiBlockId;
    delete attrs.omiSectionId;
    delete attrs.omiBlockType;
    delete attrs.omiAnchorId;
    delete attrs.omiSectionNumber;
    delete attrs.omiVisual;
    next.attrs = Object.keys(attrs).length ? attrs : undefined;
  }
  return next;
}

function readStoredBlockNodes(block: OmiBlock): JSONContent[] {
  if (!block.content.trim()) return [{ type: nodeTypeForBlock(block.type) }];
  try {
    const parsed = JSON.parse(block.content) as JSONContent;
    if (parsed?.type === 'doc' && Array.isArray(parsed.content) && parsed.content.length) {
      return parsed.content;
    }
  } catch {
    // Legacy plain text is normalized below.
  }
  return [{
    type: nodeTypeForBlock(block.type),
    content: [{ type: 'text', text: block.content }],
  }];
}

function textBlockFromNode(
  editorNode: JSONContent,
  blockId: string,
  previousBlock: OmiBlock | undefined,
  type: string,
): OmiBlock {
  return {
    ...(previousBlock ?? {}),
    id: blockId,
    type,
    content: JSON.stringify({
      type: 'doc',
      content: [stripContinuousAttributes(editorNode)],
    }),
    visual: undefined,
  };
}

function visualBlockFromNode(
  editorNode: JSONContent,
  blockId: string,
  previousBlock: OmiBlock | undefined,
): OmiBlock {
  const attrs = (editorNode.attrs ?? {}) as ContinuousNodeAttributes;
  const visual = attrs.omiVisual ?? previousBlock?.visual;
  return {
    ...(previousBlock ?? {}),
    id: blockId,
    type: stringAttribute(attrs.omiBlockType) || visual?.kind || previousBlock?.type || 'figure',
    content: '',
    ...(visual ? { visual } : {}),
  };
}

function blockTypeForNode(node: JSONContent): string {
  const stored = stringAttribute((node.attrs as ContinuousNodeAttributes | undefined)?.omiBlockType);
  if (stored && stored !== 'heading') return stored;
  if (node.type === 'heading') return 'heading';
  if (node.type === 'blockquote') return 'quote';
  return 'paragraph';
}

function nodeTypeForBlock(blockType: string): string {
  if (blockType === 'heading') return 'heading';
  if (blockType === 'quote') return 'blockquote';
  return 'paragraph';
}

function clampHeadingLevel(value: unknown): number {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.max(1, Math.min(6, Math.trunc(numeric))) : 1;
}

function textFromNode(node: JSONContent): string {
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(textFromNode).join(' ').replace(/\s+/g, ' ').trim();
}

function structuralAttributes(attributes: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(attributes).filter(([, value]) => value !== undefined),
  );
}

function stringAttribute(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function cloneJson<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
