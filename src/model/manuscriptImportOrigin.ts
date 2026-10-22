/** Portable document-level self-attestation, independent of editable content. */
export const MANUSCRIPT_IMPORT_ORIGIN = 'https://openmanuscript.org/extensions/manuscript-import-origin/1';

export function manuscriptImportOrigin(format: 'docx' | 'odt' | 'pdf', importedAt: string): Record<string, unknown> {
  return {
    [MANUSCRIPT_IMPORT_ORIGIN]: {
      version: 1,
      sourceFormat: format,
      importedAt,
      assertion: 'author-declared:self-authored-outside-omi',
    },
  };
}

/** Public projections omit private import metadata without mutating the working file. */
export function publicManuscriptExtensions(extensions?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!extensions || !(MANUSCRIPT_IMPORT_ORIGIN in extensions)) return extensions;
  const result = { ...extensions };
  delete result[MANUSCRIPT_IMPORT_ORIGIN];
  return Object.keys(result).length ? result : undefined;
}
