import { renderNoteCitation, type OmiNoteCitation } from './noteCitations';
import type {
  OmiAnnotation,
  OmiBibliographicRecord,
  OmiCitationStyleId,
} from '../types/omi';

export interface NoteJsonNode {
  type?: string;
  text?: string;
  attrs?: Record<string, unknown>;
  marks?: Array<{ type?: string; attrs?: Record<string, unknown> }>;
  content?: NoteJsonNode[];
}

declare module '../types/omi' {
  interface OmiAnnotation {
    /** Canonical rich-text note body. `body` remains a plain-text compatibility projection. */
    bodyContent?: string;
  }
}

export function createNoteBodyDocument(
  note: OmiAnnotation,
  records: readonly OmiBibliographicRecord[],
  style: OmiCitationStyleId,
  locale: string,
): NoteJsonNode {
  const stored = parseNoteBodyContent(note.bodyContent);
  if (stored) return synchronizeNoteCitationLabels(stored, note, records, style, locale);

  const content: NoteJsonNode[] = [];
  if (note.body) content.push({ type: 'text', text: note.body });

  const citations = note.noteCitations ?? [];
  if (citations.length) {
    if (content.length) content.push({ type: 'text', text: ' ' });
    citations.forEach((citation, index) => {
      if (index > 0) content.push({ type: 'text', text: '; ' });
      content.push(noteCitationNode(citation, note, records, style, locale));
    });
  }

  return {
    type: 'doc',
    content: [{ type: 'paragraph', content }],
  };
}

export function parseNoteBodyContent(value: string | undefined): NoteJsonNode | null {
  if (!value?.trim()) return null;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) && parsed.type === 'doc'
      ? parsed as NoteJsonNode
      : null;
  } catch {
    return null;
  }
}

export function collectNoteCitationIds(node: NoteJsonNode): string[] {
  const result: string[] = [];
  walk(node, (candidate) => {
    if (candidate.type !== 'omiCitation') return;
    const value = candidate.attrs?.citationId;
    if (typeof value === 'string' && value && !result.includes(value)) result.push(value);
  });
  return result;
}

export function noteBodyPlainText(node: NoteJsonNode): string {
  return textFromNode(node).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export function synchronizeNoteCitationLabels(
  node: NoteJsonNode,
  note: Pick<OmiAnnotation, 'id' | 'targetBlockId' | 'noteCitations'>,
  records: readonly OmiBibliographicRecord[],
  style: OmiCitationStyleId,
  locale: string,
): NoteJsonNode {
  const citationMap = new Map((note.noteCitations ?? []).map((citation) => [citation.id, citation]));
  return transform(node, (candidate) => {
    if (candidate.type !== 'omiCitation') return candidate;
    const citationId = candidate.attrs?.citationId;
    if (typeof citationId !== 'string') return candidate;
    const citation = citationMap.get(citationId);
    if (!citation) return candidate;
    return {
      ...candidate,
      attrs: {
        ...(candidate.attrs ?? {}),
        citationId,
        citationIds: [citationId],
        anchorId: `note-citation-anchor-${citationId}`,
        label: renderNoteCitation(citation, note, records, style, locale),
      },
    };
  });
}

export function noteCitationNode(
  citation: OmiNoteCitation,
  note: Pick<OmiAnnotation, 'id' | 'targetBlockId'>,
  records: readonly OmiBibliographicRecord[],
  style: OmiCitationStyleId,
  locale: string,
): NoteJsonNode {
  return {
    type: 'omiCitation',
    attrs: {
      citationId: citation.id,
      citationIds: [citation.id],
      anchorId: `note-citation-anchor-${citation.id}`,
      label: renderNoteCitation(citation, note, records, style, locale),
    },
  };
}

function textFromNode(node: NoteJsonNode): string {
  if (typeof node.text === 'string') return node.text;
  if (node.type === 'omiCitation') {
    const label = node.attrs?.label;
    return typeof label === 'string' ? label : '';
  }
  if (node.type === 'hardBreak') return '\n';
  const separator = node.type === 'paragraph' || node.type === 'blockquote' ? '\n' : '';
  return (node.content ?? []).map(textFromNode).join('') + separator;
}

function transform(node: NoteJsonNode, mapper: (node: NoteJsonNode) => NoteJsonNode): NoteJsonNode {
  const mapped = mapper(node);
  if (!mapped.content) return mapped;
  return { ...mapped, content: mapped.content.map((child) => transform(child, mapper)) };
}

function walk(node: NoteJsonNode, visitor: (node: NoteJsonNode) => void): void {
  visitor(node);
  for (const child of node.content ?? []) walk(child, visitor);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
