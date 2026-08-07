import type {
  OmiAgent,
  OmiContribution,
} from '../model/identity';
import type { OmiTombstone } from '../model/tombstone';
import type {
  OmiRevisionHistory,
  RevisionId,
} from '../model/versioning';

export type OmiLocale = 'hu' | 'en' | 'de' | string;

export type OmiSectionNumberingStyle =
  | 'none'
  | 'decimal'
  | 'upper-roman'
  | 'lower-roman'
  | 'upper-alpha'
  | 'lower-alpha';

export interface OmiIdentifier {
  type: 'omi' | 'doi' | 'orcid' | 'isbn' | 'issn' | 'uri' | string;
  value: string;
}

/**
 * Legacy embedded person representation.
 *
 * New documents use OmiAgent and OmiContribution. This interface remains
 * available only for importing pre-OMI-SPEC-150 manuscript data.
 */
export interface OmiPerson {
  id: string;
  givenName: string;
  familyName: string;
  affiliation?: string;
  identifiers?: OmiIdentifier[];
}

export interface OmiAnnotation {
  id: string;
  type: 'note' | 'comment' | 'editorial' | 'semantic' | string;

  /**
   * Studio note subtype. Kept optional so older annotation payloads remain
   * importable while the OMI-SPEC-130 model evolves.
   */
  noteKind?: 'footnote' | 'endnote' | 'author-note';

  /**
   * Stable semantic anchor carried by the inline Tiptap note marker.
   */
  anchorId?: string;

  targetBlockId: string;
  targetText?: string;
  body: string;
  renderingHint: 'footnote' | 'endnote' | 'margin' | 'popup' | 'hidden';
  creatorAgentId?: string;
  createdAt?: string;
  modifiedAt?: string;
}

export interface OmiCitation {
  id: string;
  citationKey: string;
  label: string;
  sourceType: 'book' | 'article' | 'chapter' | 'web' | string;
  issued?: string;
}

export interface OmiBlock {
  id: string;
  type: 'heading' | 'paragraph' | 'quote' | 'figure' | 'table' | string;
  content: string;
  children?: OmiBlock[];
}

export interface OmiSection {
  id: string;
  title: string;
  blocks: OmiBlock[];
}

/**
 * Complete manuscript state captured by an immutable revision snapshot.
 *
 * Versioning envelope fields are intentionally excluded so snapshots do not
 * recursively contain the complete revision history.
 */
export interface OmiManuscriptState {
  schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json';
  id: string;
  version: string;
  identityModelVersion: 'OMI-SPEC-150@0.1.0';
  locale: OmiLocale;
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];

  /**
   * Presentation preference for top-level section numbering.
   *
   * The semantic section title never contains the generated ordinal. This
   * keeps titles portable while allowing renderers to choose another style.
   */
  sectionNumberingStyle?: OmiSectionNumberingStyle;

  /**
   * Portable scholarly identities represented independently from accounts.
   */
  agents: OmiAgent[];

  /**
   * Contextual relationships between agents and manuscript objects.
   */
  contributions: OmiContribution[];

  /**
   * Persistent deletion evidence for addressable scholarly objects.
   *
   * Tombstones are part of committed manuscript state and survive restoration
   * so a deleted identifier cannot silently be reused for another object.
   */
  tombstones: OmiTombstone[];

  /**
   * Deprecated compatibility field for importing older documents.
   */
  authors?: OmiPerson[];

  sections: OmiSection[];
  annotations: OmiAnnotation[];
  citations: OmiCitation[];
  createdAt: string;
  updatedAt: string;
}

export interface OmiManuscript extends OmiManuscriptState {
  versioningModelVersion: 'OMI-SPEC-160@0.1.0';
  headRevisionId: RevisionId;
  revisionHistory: OmiRevisionHistory;
}
