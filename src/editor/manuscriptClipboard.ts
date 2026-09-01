import type { OmiBlock, OmiSection } from '../types/omi';
import { textFromAtomicBlock } from '../model/atomicTextBlocks';
import {
  getParentSectionId,
  withParentSectionId,
} from '../model/sectionStructure';

export const OMI_MANUSCRIPT_CLIPBOARD_MIME =
  'application/x-open-manuscript-fragment+json';

export interface OmiManuscriptClipboardFragment {
  version: 1;
  blocks: ClipboardBlock[];
}

type ClipboardBlock = Omit<OmiBlock, 'id'>;
type JsonNode = {
  type?: string;
  text?: string;
  attrs?: unknown;
  marks?: unknown;
  content?: JsonNode[];
  [key: string]: unknown;
};

interface LocatedBlock {
  sectionIndex: number;
  blockIndex: number;
  block: OmiBlock;
}

export function createManuscriptClipboardFragment(
  sections: readonly OmiSection[],
  startBlockId: string,
  startOffset: number,
  endBlockId: string,
  endOffset: number,
): OmiManuscriptClipboardFragment | undefined {
  const ordered = flattenBlocks(sections);
  const startIndex = ordered.findIndex(({ block }) => block.id === startBlockId);
  const endIndex = ordered.findIndex(({ block }) => block.id === endBlockId);
  if (startIndex < 0 || endIndex < startIndex) return undefined;

  const selected = ordered.slice(startIndex, endIndex + 1);
  const blocks = selected.map(({ block }, index) => {
    const copy = cloneClipboardBlock(block);
    if (block.visual) return copy;

    if (selected.length === 1) {
      copy.content = sliceStoredContent(block.content, startOffset, endOffset);
      return copy;
    }

    if (index === 0) {
      copy.content = sliceStoredContent(
        block.content,
        startOffset,
        getStoredTextLength(block.content),
      );
    } else if (index === selected.length - 1) {
      copy.content = sliceStoredContent(block.content, 0, endOffset);
    }
    return copy;
  });

  return { version: 1, blocks };
}

export function cutManuscriptRange(
  sections: readonly OmiSection[],
  startBlockId: string,
  startOffset: number,
  endBlockId: string,
  endOffset: number,
): OmiSection[] {
  const ordered = flattenBlocks(sections);
  const startIndex = ordered.findIndex(({ block }) => block.id === startBlockId);
  const endIndex = ordered.findIndex(({ block }) => block.id === endBlockId);
  if (startIndex < 0 || endIndex < startIndex) return cloneSections(sections);

  const start = ordered[startIndex];
  const end = ordered[endIndex];
  if (!start || !end) return cloneSections(sections);

  if (startIndex === endIndex) {
    if (start.block.visual) return cloneSections(sections);
    return sections.map((section, sectionIndex) => ({
      ...clone(section),
      blocks: section.blocks.map((block, blockIndex) =>
        sectionIndex === start.sectionIndex && blockIndex === start.blockIndex
          ? {
              ...clone(block),
              content: removeStoredContentRange(
                block.content,
                startOffset,
                endOffset,
              ),
            }
          : clone(block),
      ),
    }));
  }

  if (start.block.visual || end.block.visual) return cloneSections(sections);

  const startRemainder: OmiBlock = {
    ...clone(start.block),
    content: sliceStoredContent(start.block.content, 0, startOffset),
  };
  const endRemainder: OmiBlock = {
    ...clone(end.block),
    content: sliceStoredContent(
      end.block.content,
      endOffset,
      getStoredTextLength(end.block.content),
    ),
  };
  const boundaryBlocks = mergeCompatibleBoundaryBlocks(
    startRemainder,
    endRemainder,
  );
  const startSection = sections[start.sectionIndex];
  const endSection = sections[end.sectionIndex];
  if (!startSection || !endSection) return cloneSections(sections);

  const replacementBlocks = [
    ...startSection.blocks.slice(0, start.blockIndex).map(clone),
    ...boundaryBlocks,
    ...endSection.blocks.slice(end.blockIndex + 1).map(clone),
  ];
  const mergedStartSection = synchronizeSectionHeading({
    ...clone(startSection),
    blocks: replacementBlocks,
  });

  if (start.sectionIndex === end.sectionIndex) {
    return sections.map((section, sectionIndex) =>
      sectionIndex === start.sectionIndex
        ? mergedStartSection
        : clone(section));
  }

  const removedSectionIds = new Set(
    sections
      .slice(start.sectionIndex + 1, end.sectionIndex + 1)
      .map((section) => section.id),
  );

  return sections.flatMap((section, sectionIndex) => {
    if (sectionIndex === start.sectionIndex) return [mergedStartSection];
    if (removedSectionIds.has(section.id)) return [];

    const copied = clone(section);
    return removedSectionIds.has(getParentSectionId(copied) ?? '')
      ? [withParentSectionId(copied, mergedStartSection.id)]
      : [copied];
  });
}

export function pasteManuscriptFragment(
  sections: readonly OmiSection[],
  targetBlockId: string,
  targetOffset: number,
  fragment: OmiManuscriptClipboardFragment,
): OmiSection[] {
  if (fragment.blocks.length === 0) return cloneSections(sections);
  const located = flattenBlocks(sections).find(({ block }) => block.id === targetBlockId);
  if (!located || located.block.visual) return cloneSections(sections);

  const target = located.block;
  const targetLength = getStoredTextLength(target.content);
  const offset = clamp(targetOffset, 0, targetLength);
  const prefix = sliceStoredContent(target.content, 0, offset);
  const suffix = sliceStoredContent(target.content, offset, targetLength);
  const pasted = fragment.blocks.map(cloneClipboardBlock);

  const replacement: OmiBlock[] = [];
  if (pasted.length === 1) {
    const only = pasted[0];
    if (!only) return cloneSections(sections);
    replacement.push({
      ...clone(only),
      id: target.id,
      type: only.type || target.type,
      content: concatStoredContent(prefix, only.content, suffix),
    });
  } else {
    const first = pasted[0];
    const last = pasted[pasted.length - 1];
    if (!first || !last) return cloneSections(sections);

    replacement.push({
      ...clone(first),
      id: target.id,
      type: first.type || target.type,
      content: concatStoredContent(prefix, first.content),
    });

    for (const middle of pasted.slice(1, -1)) {
      replacement.push(cloneBlockWithNewIds(middle));
    }

    replacement.push({
      ...cloneBlockWithNewIds(last),
      content: concatStoredContent(last.content, suffix),
    });
  }

  return sections.map((section, sectionIndex) => {
    if (sectionIndex !== located.sectionIndex) return clone(section);
    return {
      ...clone(section),
      blocks: section.blocks.flatMap((block, blockIndex) =>
        blockIndex === located.blockIndex ? replacement : [clone(block)],
      ),
    };
  });
}

export function parseManuscriptClipboardFragment(
  value: string,
): OmiManuscriptClipboardFragment | undefined {
  if (!value.trim()) return undefined;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isManuscriptClipboardFragment(parsed)) return undefined;
    return clone(parsed);
  } catch {
    return undefined;
  }
}

export function getStoredTextLength(content: string): number {
  const document = parseStoredDocument(content);
  return document ? jsonTextLength(document) : content.length;
}

function removeStoredContentRange(content: string, from: number, to: number): string {
  const length = getStoredTextLength(content);
  return concatStoredContent(
    sliceStoredContent(content, 0, from),
    sliceStoredContent(content, to, length),
  );
}

function sliceStoredContent(content: string, from: number, to: number): string {
  const document = parseStoredDocument(content);
  if (!document) {
    return content.slice(clamp(from, 0, content.length), clamp(to, 0, content.length));
  }

  const length = jsonTextLength(document);
  const start = clamp(from, 0, length);
  const end = clamp(to, start, length);
  const cursor = { value: 0 };
  const sliced = sliceJsonNode(document, start, end, cursor);
  const result = sliced && sliced.type === 'doc' ? sliced : emptyDocumentLike(document);
  if (!result.content || result.content.length === 0) {
    return JSON.stringify(emptyDocumentLike(document));
  }
  return JSON.stringify(result);
}

function concatStoredContent(...parts: string[]): string {
  const documents = parts.map(normalizeStoredDocument);
  const template = documents[0] ?? paragraphDocument('');
  const nodes: JsonNode[] = [];

  for (const document of documents) {
    if (jsonTextLength(document) === 0) continue;
    for (const node of document.content ?? []) {
      appendMergedNode(nodes, clone(node));
    }
  }

  return JSON.stringify(
    nodes.length > 0
      ? { ...clone(template), type: 'doc', content: nodes }
      : emptyDocumentLike(template),
  );
}

function mergeCompatibleBoundaryBlocks(
  start: OmiBlock,
  end: OmiBlock,
): OmiBlock[] {
  if (start.type !== end.type) return [start, end];
  return [{
    ...start,
    content: concatStoredContent(start.content, end.content),
  }];
}

function synchronizeSectionHeading(section: OmiSection): OmiSection {
  const first = section.blocks[0];
  if (first?.type !== 'heading') return section;
  return {
    ...section,
    title: textFromAtomicBlock(first.content),
  };
}

function appendMergedNode(nodes: JsonNode[], next: JsonNode): void {
  const previous = nodes[nodes.length - 1];
  if (
    previous &&
    previous.type === next.type &&
    JSON.stringify(previous.attrs ?? null) === JSON.stringify(next.attrs ?? null) &&
    Array.isArray(previous.content) &&
    Array.isArray(next.content)
  ) {
    previous.content = [...previous.content, ...next.content.map(clone)];
    return;
  }
  nodes.push(next);
}

function sliceJsonNode(
  node: JsonNode,
  from: number,
  to: number,
  cursor: { value: number },
): JsonNode | null {
  if (typeof node.text === 'string') {
    const start = cursor.value;
    const end = start + node.text.length;
    cursor.value = end;
    const overlapStart = Math.max(from, start);
    const overlapEnd = Math.min(to, end);
    if (overlapStart >= overlapEnd) return null;
    return {
      ...clone(node),
      text: node.text.slice(overlapStart - start, overlapEnd - start),
    };
  }

  if (!Array.isArray(node.content)) return null;

  const children: JsonNode[] = [];
  for (const child of node.content) {
    const sliced = sliceJsonNode(child, from, to, cursor);
    if (sliced) children.push(sliced);
  }

  if (children.length === 0) return null;
  return { ...clone(node), content: children };
}

function jsonTextLength(node: JsonNode): number {
  if (typeof node.text === 'string') return node.text.length;
  return (node.content ?? []).reduce((total, child) => total + jsonTextLength(child), 0);
}

function parseStoredDocument(content: string): JsonNode | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    if (isRecord(parsed) && parsed.type === 'doc' &&
      (parsed.content === undefined || Array.isArray(parsed.content))) {
      return parsed as JsonNode;
    }
  } catch {
    // Legacy textual blocks are stored as plain strings.
  }
  return undefined;
}

function normalizeStoredDocument(content: string): JsonNode {
  return parseStoredDocument(content) ?? paragraphDocument(content);
}

function paragraphDocument(text: string): JsonNode {
  return {
    type: 'doc',
    content: [
      text
        ? { type: 'paragraph', content: [{ type: 'text', text }] }
        : { type: 'paragraph' },
    ],
  };
}

function emptyDocumentLike(document: JsonNode): JsonNode {
  const first = document.content?.[0];
  const shell = first
    ? stripTextContent(first)
    : { type: 'paragraph' };
  return { type: 'doc', content: [shell] };
}

function stripTextContent(node: JsonNode): JsonNode {
  const result = clone(node);
  delete result.text;
  if (Array.isArray(result.content)) {
    result.content = result.content
      .filter((child) => typeof child.text !== 'string')
      .map(stripTextContent);
    if (result.content.length === 0) delete result.content;
  }
  return result;
}

function flattenBlocks(sections: readonly OmiSection[]): LocatedBlock[] {
  return sections.flatMap((section, sectionIndex) =>
    section.blocks.map((block, blockIndex) => ({ sectionIndex, blockIndex, block })),
  );
}

function cloneClipboardBlock(block: OmiBlock | ClipboardBlock): ClipboardBlock {
  const copied = clone(block) as OmiBlock;
  const { id: _id, ...withoutId } = copied;
  void _id;
  return withoutId;
}

function cloneBlockWithNewIds(block: ClipboardBlock): OmiBlock {
  const copied = clone(block);
  return {
    ...copied,
    id: createId(),
    children: copied.children?.map((child) => ({
      ...clone(child),
      id: createId(),
    })),
  };
}

function cloneSections(sections: readonly OmiSection[]): OmiSection[] {
  return sections.map(clone);
}

function isManuscriptClipboardFragment(
  value: unknown,
): value is OmiManuscriptClipboardFragment {
  return isRecord(value) &&
    value.version === 1 &&
    Array.isArray(value.blocks) &&
    value.blocks.every(isClipboardBlock);
}

function isClipboardBlock(value: unknown): value is ClipboardBlock {
  return isRecord(value) && typeof value.type === 'string' && typeof value.content === 'string';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Number.isFinite(value) ? value : min));
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `clipboard-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
