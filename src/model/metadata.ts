export interface LocalizedText {
  default: string;
  values: Record<string, string>;
}

export interface LocalizedKeyword {
  id: string;
  values: Record<string, string>;
}

export interface ManuscriptMetadata {
  title: LocalizedText;
  subtitle?: LocalizedText;
  abstract?: LocalizedText;

  language: string;
  originalLanguage?: string;

  keywords: LocalizedKeyword[];

  discipline: string;
  documentType: string;
}
