import type {
  OmiAnnotation,
  OmiManuscriptState,
  OmiTableBlockData,
  OmiVisualBlockData,
} from '../types/omi';
import { sameTableCitationAnchors } from './citationClusters';
import { tableCellDocument, tableCellPlainText, cellNestedTable, tableMergeLayout } from './tableLayout';
import type { NoteJsonNode } from './noteRichText';
import { getDocumentStructureProfile } from './documentProfile';
import { getStudyRootSectionId } from './sectionStructure';
import { findManuscriptBlock, mapManuscriptBlocks, walkManuscriptStructure } from './manuscriptTreeTraversal';

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
  state: Pick<OmiManuscriptState, 'sections'>,
): NoteAnchorOccurrence[] {
  const result: NoteAnchorOccurrence[] = [];

  for (const occurrence of walkManuscriptStructure(state.sections)) {
    if (occurrence.kind === 'block') {
      result.push(...collectNoteAnchorsInBlock(
        occurrence.block.content,
        occurrence.section.id,
        occurrence.block.id,
        occurrence.block.visual,
      ));
    }
  }

  return result;
}

export function collectNoteAnchorsInBlock(
  content: string,
  sectionId: string,
  blockId: string,
  visual?: OmiVisualBlockData,
): NoteAnchorOccurrence[] {
  const result: NoteAnchorOccurrence[] = [];
  const document = parseStructuredContent(content);
  if (document) collectNoteNodes(document, sectionId, blockId, result);
  if(visual?.kind==='table') visitTableNotes(visual,sectionId,blockId,result);
  return result;
}

function visitTableNotes(table:OmiTableBlockData,sectionId:string,blockId:string,result:NoteAnchorOccurrence[]):void {
  const layout=tableMergeLayout(table.cells,table.cellMerges,table.headerRows);
  for(let r=0;r<table.cells.length;r++) for(let c=0;c<(table.cells[r]?.length??0);c++){
    if(layout.covered(r,c)) continue;
    const doc=tableCellDocument(table,r,c);
    if(doc) collectNoteNodes(doc,sectionId,blockId,result);
  }
}

/** Transform valid cell documents without changing the plain-text projection. */
function mapTableNoteDocuments(table:OmiTableBlockData,transform:(node:JsonNode)=>JsonNode):OmiTableBlockData {
  if(!table.cellContent) return table;
  let changed=false;
  const content={...table.cellContent};
  const visit=(node:JsonNode):JsonNode=>{
    const nested=cellNestedTable(node);
    if(nested) return {...node,attrs:{table:mapTableNoteDocuments(nested,transform)}};
    return node.content?{...node,content:node.content.map(visit)}:node;
  };
  for(let r=0;r<table.cells.length;r++) for(let c=0;c<(table.cells[r]?.length??0);c++){
    const doc=tableCellDocument(table,r,c);
    if(!doc) continue;
    const next=transform(visit(doc)) as NoteJsonNode;
    if(tableCellPlainText(next)!==table.cells[r]?.[c]) continue;
    if(JSON.stringify(doc)!==JSON.stringify(next)){content[r+':'+c]=JSON.stringify(next);changed=true;}
  }
  return changed?{...table,cellContent:content}:table;
}

export function getNoteCustomMark(note:OmiAnnotation|undefined):'*'|undefined{
  return note?.noteCustomMark==='*'&&getNoteKind(note)!=='author-note'?'*':undefined;
}

export function getNoteLabel(state:OmiManuscriptState,noteId:string):string|undefined{
  return getNoteCustomMark(state.annotations.find(note=>note.id===noteId))??(getNoteNumber(state,noteId)?.toString());
}

export function getNoteNumber(
  state: OmiManuscriptState,
  noteId: string,
): number | undefined {
  return buildNoteNumberMap(state).get(noteId);
}

export function sortNotesByDocumentOrder(
  state: Pick<OmiManuscriptState, 'sections' | 'annotations'>,
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
  const nextSections = mapManuscriptBlocks(state.sections, (block) => {
    const parsed = parseStructuredContent(block.content);
    const nextContent = parsed?JSON.stringify(normalizeNoteNodes(parsed, numberByNoteId, annotationById)):block.content;
    const visual=block.visual?.kind==='table'?mapTableNoteDocuments(block.visual,node=>normalizeNoteNodes(node,numberByNoteId,annotationById)):block.visual;
    if (nextContent === block.content) return visual===block.visual?block:{...block,visual};

    blockChanges.push({
      blockId: block.id,
      previousContent: block.content,
      nextContent,
    });
    return { ...block, content: nextContent, ...(visual?{visual}:{}) };
  });

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
  const sectionsWithoutAnchor = mapManuscriptBlocks(state.sections, (block) => {
    const parsed = parseStructuredContent(block.content);
    const nextContent = parsed?JSON.stringify(removeNoteNodes(parsed,noteId)):block.content;
    const visual=block.visual?.kind==='table'?mapTableNoteDocuments(block.visual,node=>removeNoteNodes(node,noteId)):block.visual;
    return nextContent===block.content&&visual===block.visual?block:{...block,content:nextContent,...(visual?{visual}:{})};
  });

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
    [...walkManuscriptStructure(state.sections)]
      .filter((item) => item.kind === 'block')
      .map(({ block }) => [block.id, block.content] as const),
  );
  const finalBlockChanges = [...walkManuscriptStructure(reconciled.state.sections)]
    .filter((item) => item.kind === 'block')
    .flatMap(({ block }) => {
      const previousContent = originalBlockContents.get(block.id);
      return previousContent === undefined || previousContent === block.content
        ? []
        : [{ blockId: block.id, previousContent, nextContent: block.content }];
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

  const nested=cellNestedTable(node);
  if(nested) visitTableNotes(nested,sectionId,blockId,result);
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
        label: kind === 'author-note' ? '' : getNoteCustomMark(annotation)??String(numberByNoteId.get(noteId) ?? '?'),
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
  state: Pick<OmiManuscriptState, 'sections' | 'documentStructure'> & Partial<Pick<OmiManuscriptState, 'annotations'>>,
  occurrences: NoteAnchorOccurrence[] = collectNoteAnchors(state),
  options: { includeLocalNotes?: boolean } = {},
): Map<string, number> {
  const scope = getDocumentStructureProfile(state).noteNumberingScope;
  const counters = new Map<string, number>();
  const result = new Map<string, number>();
  const kindById = new Map(
    (state.annotations ?? []).filter(isNoteAnnotation).map((note) => [note.id, getNoteKind(note)]),
  );
  const customIds=new Set((state.annotations??[]).filter(note=>getNoteCustomMark(note)).map(note=>note.id));

  for (const occurrence of occurrences) {
    if (result.has(occurrence.noteId)||customIds.has(occurrence.noteId)) continue;
    if (!options.includeLocalNotes && (kindById.get(occurrence.noteId) ?? occurrence.kind) === 'author-note') continue;
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

export function buildNoteLabelMap(state:Parameters<typeof buildNoteNumberMap>[0],occurrences:NoteAnchorOccurrence[]=collectNoteAnchors(state),options:Parameters<typeof buildNoteNumberMap>[2]={}):Map<string,string>{
  const numbers=buildNoteNumberMap(state,occurrences,options);
  const custom=new Map((state.annotations??[]).filter(note=>getNoteCustomMark(note)).map(note=>[note.id,'*'] as const));
  const labels=new Map<string,string>();
  for(const occurrence of occurrences){const label=custom.get(occurrence.noteId)??numbers.get(occurrence.noteId)?.toString();if(label!==undefined)labels.set(occurrence.noteId,label);}
  return labels;
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

export interface TableNoteInsertion {
  id:string;
  anchorId:string;
  kind:OmiNoteKind;
}
const anchorKey=(note:NoteAnchorOccurrence)=>JSON.stringify([note.noteId,note.anchorId]);
/** Atomic table edit: only a specifically authorized new anchor may change
 * the anchor inventory. Deletion uses the shared removeNoteFromState action. */
export function applyTableNoteEdit(
  state:OmiManuscriptState,blockId:string,expected:OmiTableBlockData,next:OmiTableBlockData,
  insertion?:TableNoteInsertion,actorAgentId?:string,timestamp?:string,
):NoteReconciliationResult|undefined {
  const located=findManuscriptBlock(state.sections,blockId);
  if(!located||located.block.visual?.kind!=='table'||JSON.stringify(located.block.visual)!==JSON.stringify(expected)) return undefined;
  if(!sameTableCitationAnchors(expected,next))return undefined;
  const old=collectNoteAnchorsInBlock('',located.section.id,blockId,expected);
  const incoming=collectNoteAnchorsInBlock('',located.section.id,blockId,next);
  const required=old.map(anchorKey);
  let annotations=state.annotations;
  if(insertion){
    if(!insertion.id.trim()||!insertion.anchorId.trim()||!['footnote','endnote','author-note'].includes(insertion.kind)) return undefined;
    if(state.annotations.some(n=>n.id===insertion.id||n.anchorId===insertion.anchorId)||state.tombstones?.some(t=>t.objectId===insertion.id)) return undefined;
    if(collectNoteAnchors(state).some(n=>n.noteId===insertion.id||n.anchorId===insertion.anchorId)) return undefined;
    const anchor=incoming.find(n=>n.noteId===insertion.id&&n.anchorId===insertion.anchorId);
    if(!anchor||anchor.kind!==insertion.kind) return undefined;
    required.push(anchorKey(anchor));
    annotations=[...annotations,createNoteAnnotation({id:insertion.id,anchorId:insertion.anchorId,targetBlockId:blockId,kind:insertion.kind,creatorAgentId:actorAgentId,timestamp})];
  }
  if(new Set(incoming.map(n=>n.noteId)).size!==incoming.length||JSON.stringify(required.sort())!==JSON.stringify(incoming.map(anchorKey).sort())) return undefined;
  const sections=mapManuscriptBlocks(state.sections,block=>block.id===blockId?{...block,visual:next}:block);
  return reconcileNoteState({...state,sections,annotations},{removeOrphanAnnotations:false});
}
