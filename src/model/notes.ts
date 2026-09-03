import type {
  OmiAnnotation,
  OmiManuscriptState,
  OmiSection,
} from '../types/omi';
import { getDocumentStructureProfile } from './documentProfile';
import { getStudyRootSectionId } from './sectionStructure';

export type OmiNoteKind =
  | 'footnote'
  | 'endnote'
  | 'author-note';

export interface CreateNoteAnnotationInput {
  id: string;
  anchorId: string;
  targetBlockId: string;
  kind?: OmiNoteKind;
  body?: string;
  creatorAgentId?: string;
  timestamp?: string;
}

export interface NoteAnchorOccurrence {
  noteId: string;
  anchorId: string;
  blockId: string;
  sectionId: string;
  kind: OmiNoteKind;
}

export interface NoteReconciliationResult {
  state: OmiManuscriptState;
  blockChanges: Array<{
    blockId: string;
    previousContent: string;
    nextContent: string;
  }>;
  removedAnnotations: OmiAnnotation[];
  updatedAnnotations: Array<{
    previous: OmiAnnotation;
    next: OmiAnnotation;
  }>;
}

interface JsonNode {
  type?: string;
  attrs?: Record<string, unknown>;
  content?: JsonNode[];
  [key: string]: unknown;
}

export function createNoteAnnotation(
  input: CreateNoteAnnotationInput,
): OmiAnnotation {
  const timestamp = input.timestamp ?? new Date().toISOString();
  const kind = input.kind ?? 'footnote';

  return {
    id: input.id,
    type: 'note',
    noteKind: kind,
    anchorId: input.anchorId,
    targetBlockId: input.targetBlockId,
    body: input.body ?? '',
    renderingHint: renderingHintForNoteKind(kind),
    creatorAgentId: input.creatorAgentId,
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function isNoteAnnotation(
  annotation: OmiAnnotation,
): boolean {
  return annotation.type === 'note' || Boolean(annotation.noteKind);
}

export function getNoteKind(
  annotation: OmiAnnotation,
): OmiNoteKind {
  if (
    annotation.noteKind === 'footnote' ||
    annotation.noteKind === 'endnote' ||
    annotation.noteKind === 'author-note'
  ) {
    return annotation.noteKind;
  }

  if (annotation.renderingHint === 'endnote') {
    return 'endnote';
  }

  return 'footnote';
}

export function collectNoteAnchors(
  state: OmiManuscriptState,
): NoteAnchorOccurrence[] {
  const result: NoteAnchorOccurrence[] = [];

  for (const section of state.sections) {
    for (const block of section.blocks) {
      const document = parseStructuredContent(block.content);

      if (!document) {
        continue;
      }

      collectNoteNodes(
        document,
        section.id,
        block.id,
        result,
      );
    }
  }

  return result;
}

export function getNoteNumber(
  state: OmiManuscriptState,
  noteId: string,
): number | undefined {
  return buildNoteNumberMap(state).get(noteId);
}

export function sortNotesByDocumentOrder(
  state: OmiManuscriptState,
  occurrences: NoteAnchorOccurrence[] = collectNoteAnchors(state),
): OmiAnnotation[] {
  const order = uniqueNoteIdentifiers(occurrences);
  const indexById = new Map(
    order.map((id, index) => [id, index]),
  );

  return state.annotations
    .filter(isNoteAnnotation)
    .slice()
    .sort((left, right) => {
      const leftIndex = indexById.get(left.id) ?? Number.MAX_SAFE_INTEGER;
      const rightIndex = indexById.get(right.id) ?? Number.MAX_SAFE_INTEGER;

      if (leftIndex !== rightIndex) {
        return leftIndex - rightIndex;
      }

      return left.id.localeCompare(right.id);
    });
}

export function reconcileNoteState(
  state: OmiManuscriptState,
  options: { removeOrphanAnnotations?: boolean } = {},
): NoteReconciliationResult {
  const occurrences = collectNoteAnchors(state);
  const firstOccurrenceByNoteId = new Map<string, NoteAnchorOccurrence>();

  for (const occurrence of occurrences) {
    if (!firstOccurrenceByNoteId.has(occurrence.noteId)) {
      firstOccurrenceByNoteId.set(occurrence.noteId, occurrence);
    }
  }

  const numberByNoteId = buildNoteNumberMap(state, occurrences);
  const annotationById = new Map(
    state.annotations
      .filter(isNoteAnnotation)
      .map((annotation) => [annotation.id, annotation]),
  );
  const removedAnnotations: OmiAnnotation[] = [];
  const updatedAnnotations: NoteReconciliationResult['updatedAnnotations'] = [];
  const nextAnnotations: OmiAnnotation[] = [];

  for (const annotation of state.annotations) {
    if (!isNoteAnnotation(annotation)) {
      nextAnnotations.push(annotation);
      continue;
    }

    const occurrence = firstOccurrenceByNoteId.get(annotation.id);

    if (!occurrence && options.removeOrphanAnnotations) {
      removedAnnotations.push(annotation);
      continue;
    }

    if (!occurrence) {
      nextAnnotations.push(annotation);
      continue;
    }

    const nextAnnotation: OmiAnnotation = {
      ...annotation,
      anchorId: occurrence.anchorId,
      targetBlockId: occurrence.blockId,
      noteKind: getNoteKind(annotation),
      renderingHint: renderingHintForNoteKind(getNoteKind(annotation)),
    };

    if (!annotationsAreEqual(annotation, nextAnnotation)) {
      updatedAnnotations.push({
        previous: annotation,
        next: nextAnnotation,
      });
    }

    nextAnnotations.push(nextAnnotation);
  }

  const blockChanges: NoteReconciliationResult['blockChanges'] = [];
  const nextSections: OmiSection[] = state.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      const parsed = parseStructuredContent(block.content);

      if (!parsed) {
        return block;
      }

      const transformed = normalizeNoteNodes(
        parsed,
        numberByNoteId,
        annotationById,
      );
      const nextContent = JSON.stringify(transformed);

      if (nextContent === block.content) {
        return block;
      }

      blockChanges.push({
        blockId: block.id,
        previousContent: block.content,
        nextContent,
      });

      return {
        ...block,
        content: nextContent,
      };
    }),
  }));

  return {
    state: {
      ...state,
      sections: nextSections,
      annotations: nextAnnotations,
    },
    blockChanges,
    removedAnnotations,
    updatedAnnotations,
  };
}

export function removeNoteFromState(
  state: OmiManuscriptState,
  noteId: string,
): NoteReconciliationResult {
  const removedAnnotation = state.annotations.find(
    (annotation) => annotation.id === noteId && isNoteAnnotation(annotation),
  );
  const sectionsWithoutAnchor = state.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      const parsed = parseStructuredContent(block.content);

      if (!parsed) {
        return block;
      }

      const nextDocument = removeNoteNodes(parsed, noteId);
      const nextContent = JSON.stringify(nextDocument);

      return nextContent === block.content
        ? block
        : { ...block, content: nextContent };
    }),
  }));
  const stateWithoutAnnotation: OmiManuscriptState = {
    ...state,
    sections: sectionsWithoutAnchor,
    annotations: state.annotations.filter(
      (annotation) => annotation.id !== noteId,
    ),
  };
  const reconciled = reconcileNoteState(stateWithoutAnnotation, {
    removeOrphanAnnotations: false,
  });
  const originalBlockContents = new Map(
    state.sections.flatMap((section) =>
      section.blocks.map((block) => [block.id, block.content] as const),
    ),
  );
  const finalBlockChanges = reconciled.state.sections
    .flatMap((section) => section.blocks)
    .flatMap((block) => {
      const previousContent = originalBlockContents.get(block.id);

      if (previousContent === undefined || previousContent === block.content) {
        return [];
      }

      return [{
        blockId: block.id,
        previousContent,
        nextContent: block.content,
      }];
    });

  return {
    ...reconciled,
    blockChanges: finalBlockChanges,
    removedAnnotations: removedAnnotation
      ? [removedAnnotation, ...reconciled.removedAnnotations]
      : reconciled.removedAnnotations,
  };
}

export function renderingHintForNoteKind(
  kind: OmiNoteKind,
): OmiAnnotation['renderingHint'] {
  switch (kind) {
    case 'endnote':
      return 'endnote';
    case 'author-note':
      return 'margin';
    case 'footnote':
    default:
      return 'footnote';
  }
}

function collectNoteNodes(
  node: JsonNode,
  sectionId: string,
  blockId: string,
  result: NoteAnchorOccurrence[],
): void {
  if (node.type === 'omiNote') {
    const noteId = stringAttribute(node.attrs, 'noteId');

    if (noteId) {
      result.push({
        noteId,
        anchorId:
          stringAttribute(node.attrs, 'anchorId') ??
          stableAnchorIdForLegacyNote(noteId),
        blockId,
        sectionId,
        kind: normalizeNoteKind(
          stringAttribute(node.attrs, 'noteType'),
        ),
      });
    }
  }

  for (const child of node.content ?? []) {
    collectNoteNodes(child, sectionId, blockId, result);
  }
}

function normalizeNoteNodes(
  node: JsonNode,
  numberByNoteId: Map<string, number>,
  annotationById: Map<string, OmiAnnotation>,
): JsonNode {
  const nextNode: JsonNode = { ...node };

  if (node.type === 'omiNote') {
    const noteId = stringAttribute(node.attrs, 'noteId');

    if (noteId) {
      const annotation = annotationById.get(noteId);
      const kind = annotation
        ? getNoteKind(annotation)
        : normalizeNoteKind(stringAttribute(node.attrs, 'noteType'));

      nextNode.attrs = {
        ...(node.attrs ?? {}),
        noteId,
        anchorId:
          annotation?.anchorId ??
          stringAttribute(node.attrs, 'anchorId') ??
          stableAnchorIdForLegacyNote(noteId),
        label: String(numberByNoteId.get(noteId) ?? '?'),
        noteType: kind,
      };
    }
  }

  if (node.content) {
    nextNode.content = node.content.map((child) =>
      normalizeNoteNodes(child, numberByNoteId, annotationById),
    );
  }

  return nextNode;
}

function removeNoteNodes(
  node: JsonNode,
  noteId: string,
): JsonNode {
  const nextNode: JsonNode = { ...node };

  if (node.content) {
    nextNode.content = node.content
      .filter(
        (child) =>
          !(
            child.type === 'omiNote' &&
            stringAttribute(child.attrs, 'noteId') === noteId
          ),
      )
      .map((child) => removeNoteNodes(child, noteId));
  }

  return nextNode;
}

function parseStructuredContent(content: string): JsonNode | null {
  try {
    const parsed: unknown = JSON.parse(content);

    if (
      parsed &&
      typeof parsed === 'object' &&
      (parsed as JsonNode).type === 'doc'
    ) {
      return parsed as JsonNode;
    }
  } catch {
    return null;
  }

  return null;
}

function uniqueNoteIdentifiers(
  occurrences: NoteAnchorOccurrence[],
): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const occurrence of occurrences) {
    if (!seen.has(occurrence.noteId)) {
      seen.add(occurrence.noteId);
      result.push(occurrence.noteId);
    }
  }

  return result;
}

export function buildNoteNumberMap(
  state: OmiManuscriptState,
  occurrences: NoteAnchorOccurrence[] = collectNoteAnchors(state),
): Map<string, number> {
  const scope = getDocumentStructureProfile(state).noteNumberingScope;
  const counters = new Map<string, number>();
  const result = new Map<string, number>();

  for (const occurrence of occurrences) {
    if (result.has(occurrence.noteId)) continue;
    const scopeKey = scope === 'continuous'
      ? 'document'
      : scope === 'section'
        ? `section:${occurrence.sectionId}`
        : `study:${getStudyRootSectionId(state.sections, occurrence.sectionId) ?? occurrence.sectionId}`;
    const number = (counters.get(scopeKey) ?? 0) + 1;
    counters.set(scopeKey, number);
    result.set(occurrence.noteId, number);
  }

  return result;
}

function normalizeNoteKind(value: string | undefined): OmiNoteKind {
  if (
    value === 'endnote' ||
    value === 'author-note'
  ) {
    return value;
  }

  return 'footnote';
}

function stringAttribute(
  attributes: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const value = attributes?.[key];

  return typeof value === 'string' && value.trim().length > 0
    ? value
    : undefined;
}

function stableAnchorIdForLegacyNote(noteId: string): string {
  return `note-anchor-${noteId}`;
}

function annotationsAreEqual(
  first: OmiAnnotation,
  second: OmiAnnotation,
): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}
