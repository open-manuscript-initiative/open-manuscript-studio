import type {
  OmiAgent,
  OmiContribution,
} from '../model/identity';
import type {
  OmiRevisionHistory,
  RevisionId,
} from '../model/versioning';

export type OmiLocale = 'hu' | 'en' | 'de' | string;

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
  targetBlockId: string;
  targetText?: string;
  body: string;
  renderingHint: 'footnote' | 'endnote' | 'margin' | 'popup' | 'hidden';
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
   * Portable scholarly identities represented independently from accounts.
   */
  agents: OmiAgent[];

  /**
   * Contextual relationships between agents and manuscript objects.
   */
  contributions: OmiContribution[];

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
