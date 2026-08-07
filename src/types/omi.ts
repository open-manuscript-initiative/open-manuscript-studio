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

/**
 * Built-in CSL-oriented presentation profiles available in Studio.
 *
 * This is a manuscript presentation preference, not bibliographic metadata.
 * A later publication profile may override it without rewriting citation
 * occurrences or reference records.
 */
export type OmiCitationStyleId =
  | 'apa-7'
  | 'chicago-author-date'
  | 'chicago-notes-bibliography'
  | 'mla-9'
  | 'iso-690';

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

export type OmiBibliographicResourceType =
  | 'journal-article'
  | 'book'
  | 'book-chapter'
  | 'conference-paper'
  | 'thesis'
  | 'dissertation'
  | 'report'
  | 'preprint'
  | 'dataset'
  | 'software'
  | 'standard'
  | 'archival-source'
  | 'manuscript'
  | 'web-page'
  | string;

export type OmiBibliographicContributorRole =
  | 'author'
  | 'editor'
  | 'translator'
  | 'compiler'
  | 'contributor'
  | string;

export interface OmiBibliographicContributor {
  id: string;
  role: OmiBibliographicContributorRole;
  givenName?: string;
  familyName?: string;
  literalName?: string;
}

export interface OmiBibliographicIdentifier {
  scheme: 'doi' | 'isbn' | 'issn' | 'pmid' | 'arxiv' | 'url' | string;
  value: string;
}

export type OmiBibliographicRecordStatus =
  | 'unresolved'
  | 'provisional'
  | 'resolved'
  | 'verified'
  | 'conflicted'
  | 'deprecated';

/**
 * Portable OMI-SPEC-220 bibliographic record.
 *
 * The record describes the cited work once. Individual acts of citing it are
 * represented separately by OmiCitation objects.
 */
export interface OmiBibliographicRecord {
  id: string;
  type: OmiBibliographicResourceType;
  title: string;
  subtitle?: string;
  contributors: OmiBibliographicContributor[];
  containerTitle?: string;
  issued?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  language?: string;
  identifiers: OmiBibliographicIdentifier[];
  url?: string;
  accessed?: string;
  status: OmiBibliographicRecordStatus;
  createdAt?: string;
  modifiedAt?: string;
}

export type OmiCitationLocatorType =
  | 'page'
  | 'page-range'
  | 'chapter'
  | 'section'
  | 'paragraph'
  | 'figure'
  | 'table'
  | 'folio'
  | 'line'
  | 'timestamp'
  | string;

export interface OmiCitationLocator {
  type: OmiCitationLocatorType;
  value: string;
}

export type OmiCitationMode =
  | 'parenthetical'
  | 'narrative'
  | 'note'
  | 'bibliography-only'
  | string;

/**
 * OMI-SPEC-210 citation occurrence.
 *
 * The complete bibliographic metadata is never duplicated here. `target`
 * references one record in manuscript.bibliographicRecords.
 */
export interface OmiCitation {
  id: string;
  target: string;
  anchorId: string;
  targetBlockId: string;

  /**
   * Optional semantic cluster membership. Citations in the same cluster share
   * one inline anchor while retaining independent target/locator semantics.
   */
  clusterId?: string;

  locator?: OmiCitationLocator;
  prefix?: string;
  suffix?: string;
  mode?: OmiCitationMode;
  intent?: string;
  createdAt?: string;
  modifiedAt?: string;

  /**
   * Deprecated pre-OMI-SPEC-210 compatibility fields. New citations must not
   * use these as their authoritative representation.
   */
  citationKey?: string;
  label?: string;
  sourceType?: string;
  issued?: string;
}

/**
 * Ordered group of citation occurrences rendered at one stable text anchor.
 *
 * The cluster does not duplicate bibliographic metadata. Its ordered
 * `citationIds` array only groups independent OmiCitation occurrences.
 */
export interface OmiCitationCluster {
  id: string;
  anchorId: string;
  targetBlockId: string;
  citationIds: string[];
  createdAt?: string;
  modifiedAt?: string;
}

export interface OmiImportProvenance {
  sourceFormat:
    | 'image'
    | 'csv'
    | 'tsv'
    | 'html'
    | 'xlsx'
    | 'docx'
    | 'clipboard'
    | string;
  fileName?: string;
  importedAt: string;
  sourcePart?: string;
}

export interface OmiImageBlockData {
  kind: 'image';
  /** Portable alpha representation. Future OMI containers may externalize it. */
  src: string;
  mediaType: string;
  fileName?: string;
  alt: string;
  caption?: string;
  width?: number;
  height?: number;
  provenance?: OmiImportProvenance;
}

export interface OmiTableBlockData {
  kind: 'table';
  /** Rectangular cell matrix. Cell text is scholarly data, not presentation HTML. */
  cells: string[][];
  headerRows?: number;
  caption?: string;
  provenance?: OmiImportProvenance;
}

export type OmiChartType = 'bar' | 'line' | 'pie' | 'scatter';

export interface OmiChartBlockData {
  kind: 'chart';
  chartType: OmiChartType;
  /**
   * Source data table retained so imported spreadsheet charts remain editable.
   * Row 0 is interpreted as series headings and column 0 as category/x labels.
   */
  cells: string[][];
  title?: string;
  caption?: string;
  provenance?: OmiImportProvenance;
}

export interface OmiEquationBlockData {
  kind: 'equation';
  notation: 'latex' | 'mathml' | 'omml';
  source: string;
  /** Editable LaTeX normalization used by Studio when available. */
  latex?: string;
  label?: string;
  caption?: string;
  provenance?: OmiImportProvenance;
}

export type OmiVisualBlockData =
  | OmiImageBlockData
  | OmiTableBlockData
  | OmiChartBlockData
  | OmiEquationBlockData;

export interface OmiBlock {
  id: string;
  type:
    | 'heading'
    | 'paragraph'
    | 'quote'
    | 'figure'
    | 'image'
    | 'table'
    | 'chart'
    | 'equation'
    | string;
  /** Tiptap JSON or legacy text for textual blocks; empty for structured visual blocks. */
  content: string;
  visual?: OmiVisualBlockData;
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
   * Preferred citation/bibliography presentation profile for authoring.
   * Publication profiles may override this later without changing semantic
   * citation or bibliographic objects.
   */
  citationStyle?: OmiCitationStyleId;

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

  /**
   * Manuscript-local OMI-SPEC-220 reference library. Optional while older
   * alpha manuscripts are still importable; new Studio edits initialize it.
   */
  bibliographicRecords?: OmiBibliographicRecord[];

  /**
   * OMI-SPEC-210 citation occurrences anchored in manuscript content.
   */
  citations: OmiCitation[];

  /**
   * Ordered groups of citation occurrences that share one inline anchor.
   * Optional for compatibility with pre-cluster alpha manuscripts.
   */
  citationClusters?: OmiCitationCluster[];

  createdAt: string;
  updatedAt: string;
}

export interface OmiManuscript extends OmiManuscriptState {
  versioningModelVersion: 'OMI-SPEC-160@0.1.0';
  headRevisionId: RevisionId;
  revisionHistory: OmiRevisionHistory;
}
