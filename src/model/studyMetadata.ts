import type { OmiScholarlyMetadata } from './scholarlyMetadata';
import type { OmiLocale } from '../types/omi';

/** Document-level metadata retained on the root of an imported volume study. */
export interface OmiStudyMetadata {
  modelVersion: '0.1.0-alpha.1';
  title: string;
  subtitle?: string;
  abstract?: string;
  keywords: string[];
  locale: OmiLocale;
  abstracts?: Partial<Record<OmiLocale, string>>;
  keywordsByLocale?: Partial<Record<OmiLocale, string[]>>;
  scholarlyMetadata?: OmiScholarlyMetadata;
  source?: {
    format: 'omi';
    manuscriptId: string;
    fileName?: string;
    importedAt: string;
  };
}

declare module '../types/omi' {
  interface OmiSection {
    /** Present only on a top-level study root inside an edited volume. */
    studyMetadata?: OmiStudyMetadata;
  }
}
