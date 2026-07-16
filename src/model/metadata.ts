import type { LocalizedText } from './localizedText';

export interface LocalizedKeyword {
  id: string;
  values: Record<string, string>;
}

export interface ManuscriptLicense {
  id: string;
  name: string;
  url?: string;
}

export interface ManuscriptIdentifiers {
  doi?: string | null;
  ark?: string | null;
  isbn?: string | null;
  issn?: string | null;
  custom?: Array<{ scheme: string; value: string }>;
}

export interface ManuscriptDates {
  created: string;
  modified: string;
  submitted?: string | null;
  accepted?: string | null;
  published?: string | null;
}

export interface ManuscriptMetadata {
  title: LocalizedText;
  subtitle?: LocalizedText;
  abstract?: LocalizedText;
  language: string;
  originalLanguage?: string;
  discipline: string;
  documentType: string;
  keywords: LocalizedKeyword[];
  license?: ManuscriptLicense;
  identifiers?: ManuscriptIdentifiers;
  dates: ManuscriptDates;
}
