import { renderCitationCluster } from './cslRendering';
import type {
  OmiAnnotation,
  OmiBibliographicRecord,
  OmiCitation,
  OmiCitationLocator,
  OmiCitationStyleId,
} from '../types/omi';

export interface OmiNoteCitation {
  id: string;
  target: string;
  locator?: OmiCitationLocator;
  prefix?: string;
  suffix?: string;
  createdAt?: string;
  modifiedAt?: string;
}

declare module '../types/omi' {
  interface OmiAnnotation {
    /** Ordered semantic citations embedded in this note body. */
    noteCitations?: OmiNoteCitation[];
  }
}

export function renderNoteCitation(
  citation: OmiNoteCitation,
  note: Pick<OmiAnnotation, 'id' | 'targetBlockId'>,
  records: readonly OmiBibliographicRecord[],
  style: OmiCitationStyleId,
  locale: string,
): string {
  const occurrence: OmiCitation = {
    id: citation.id,
    target: citation.target,
    anchorId: `note-citation-anchor-${citation.id}`,
    targetBlockId: note.targetBlockId,
    locator: citation.locator,
    prefix: citation.prefix,
    suffix: citation.suffix,
    mode: 'note',
  };

  return renderCitationCluster([occurrence], records, style, locale);
}

export function createNoteCitation(
  target: string,
  locator?: OmiCitationLocator,
): OmiNoteCitation {
  const timestamp = new Date().toISOString();
  return {
    id: `note-citation-${crypto.randomUUID()}`,
    target,
    locator,
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function normalizeNoteCitations(
  citations: readonly OmiNoteCitation[] | undefined,
  records: readonly OmiBibliographicRecord[],
): OmiNoteCitation[] {
  if (!citations?.length) return [];
  const validTargets = new Set(records.map((record) => record.id));
  const seen = new Set<string>();
  return citations.filter((citation) => {
    if (!citation.id || !validTargets.has(citation.target) || seen.has(citation.id)) {
      return false;
    }
    seen.add(citation.id);
    return true;
  });
}
