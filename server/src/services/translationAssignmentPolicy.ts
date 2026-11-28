export interface TranslationLanguagePair { sourceLanguage: string; targetLanguage: string; }
export interface AssignmentTranslation {
  sourceLanguage: string; targetLanguage: string; title: string; abstract: string; keywords: string[]; documentCompleted: boolean;
}

/** OJS region suffixes do not change a language pair; explicit scripts remain distinct. */
export function translationLanguage(value: unknown): string {
  if (typeof value !== 'string' || value.length > 32) throw new Error('Enter a valid translation language.');
  const locale = new Intl.Locale(value.trim().replaceAll('_', '-'));
  if (locale.language === 'und') throw new Error('An explicit translation language is required.');
  return [locale.language, locale.script].filter(Boolean).join('-');
}

export function normalizeTranslationLanguagePairs(value: unknown): TranslationLanguagePair[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error('Specify at most 32 translation language pairs.');
  const result = new Map<string, TranslationLanguagePair>();
  for (const raw of value) {
    if (!raw || typeof raw !== 'object') throw new Error('Invalid translation language pair.');
    const pair = raw as Record<string, unknown>;
    const sourceLanguage = translationLanguage(pair.sourceLanguage), targetLanguage = translationLanguage(pair.targetLanguage);
    if (sourceLanguage === targetLanguage) throw new Error('Source and target translation languages must differ.');
    result.set(`${sourceLanguage}>${targetLanguage}`, { sourceLanguage, targetLanguage });
  }
  return [...result.values()];
}

export function matchesTranslationPair(pairs: TranslationLanguagePair[], source: unknown, target: unknown): boolean {
  try {
    const from = translationLanguage(source), to = translationLanguage(target);
    return pairs.some(pair => pair.sourceLanguage === from && pair.targetLanguage === to);
  } catch { return false; }
}

export function normalizePublicationLanguages(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 32) throw new Error('Specify the full-text publication languages.');
  return [...new Set(value.map(translationLanguage))];
}

export function requiresDocumentTranslation(target: unknown, publicationLanguages: string[]): boolean {
  return publicationLanguages.includes(translationLanguage(target));
}

/** Returned translations must never become the primary source for another language. */
export function translationDocumentMatchesSourceLanguage(fileName: string, sourceLanguage: unknown): boolean {
  const match = /^translation-([a-z]{2,8}(?:-[a-z]{4})?)-([a-z]{2,8}(?:-[a-z]{4})?)-assignment-/i.exec(fileName);
  if (!match) return true;
  try { return translationLanguage(sourceLanguage) === translationLanguage(match[2]); }
  catch { return false; }
}

export function readAssignmentTranslation(value: unknown): AssignmentTranslation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  let sourceLanguage: string, targetLanguage: string;
  try { sourceLanguage = translationLanguage(record.sourceLanguage); targetLanguage = translationLanguage(record.targetLanguage); }
  catch { return undefined; }
  const text = (value: unknown, max: number) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  return { sourceLanguage, targetLanguage, title: text(record.title, 500), abstract: text(record.abstract, 20_000),
    keywords: Array.isArray(record.keywords) ? record.keywords.slice(0, 100).map(value => text(value, 200)).filter(Boolean) : [],
    documentCompleted: record.documentCompleted === true };
}

export function validateAssignmentTranslation(assignment: {
  assignmentType: string; sourceLanguage: string | null; targetLanguage: string | null; publicationLanguages: string[];
  reviewRevisionSnapshot: unknown;
}): AssignmentTranslation | undefined {
  if (assignment.assignmentType !== 'TRANSLATION') return undefined;
  const snapshot = assignment.reviewRevisionSnapshot as { translation?: unknown; blocks?: unknown[] } | null;
  const translated = readAssignmentTranslation(snapshot?.translation);
  if (!translated || translated.sourceLanguage !== translationLanguage(assignment.sourceLanguage) || translated.targetLanguage !== translationLanguage(assignment.targetLanguage)) {
    throw new Error('Save the translation for this assignment’s source and target languages before submitting.');
  }
  if (!translated.title || !translated.abstract || !translated.keywords.length) throw new Error('Translated title, abstract and keywords are all required.');
  if (requiresDocumentTranslation(assignment.targetLanguage, assignment.publicationLanguages) && (!translated.documentCompleted || !snapshot?.blocks?.length)) {
    throw new Error('Complete and confirm the full manuscript translation for its publication language.');
  }
  return translated;
}
