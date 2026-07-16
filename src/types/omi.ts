export type OmiLocale = 'hu' | 'en' | 'de' | string;

export interface OmiIdentifier {
  type: 'omi' | 'doi' | 'orcid' | 'isbn' | 'issn' | 'uri' | string;
  value: string;
}

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

export interface OmiManuscript {
  schema: 'https://openmanuscript.org/schemas/omi-manuscript-0.1.json';
  id: string;
  version: string;
  locale: OmiLocale;
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  authors: OmiPerson[];
  sections: OmiSection[];
  annotations: OmiAnnotation[];
  citations: OmiCitation[];
  createdAt: string;
  updatedAt: string;
}
