import type { OmiPublicationProfile } from './publicationProfile';

export const MAX_PUBLISHER_EXPORT_CSS_BYTES = 256 * 1024;

export interface OmiPublisherExportStylesheet {
  model: 'OMI-PUBLISHER-EXPORT-STYLESHEET';
  version: '0.1.0';
  fileName: string;
  mediaType: 'text/css';
  cssText: string;
  scope: 'publication-export';
  addedAt: string;
}

export interface OmiPublisherPrintStylesheet {
  model: 'OMI-PUBLISHER-PRINT-STYLESHEET';
  version: '0.1.0';
  fileName: string;
  mediaType: 'text/css';
  cssText: string;
  scope: 'print-pdf';
  addedAt: string;
}

declare module './publicationProfile' {
  interface OmiPublicationProfile {
    /** General publisher presentation rules used by publication exports. */
    exportStylesheet?: OmiPublisherExportStylesheet;
    /** Print/PDF overrides, including CSS Paged Media rules such as @page. */
    printStylesheet?: OmiPublisherPrintStylesheet;
  }
}

export function validatePublisherExportCss(cssText: string): string | undefined {
  const bytes = new TextEncoder().encode(cssText).byteLength;
  if (bytes > MAX_PUBLISHER_EXPORT_CSS_BYTES) {
    return `CSS stylesheet exceeds the ${MAX_PUBLISHER_EXPORT_CSS_BYTES / 1024} KB limit.`;
  }
  if (/\@import\b/i.test(cssText)) {
    return 'CSS @import rules are not allowed in portable publisher stylesheets.';
  }
  if (/<\/style\s*>/i.test(cssText)) {
    return 'Closing style tags are not allowed in publisher stylesheets.';
  }
  if (/url\(\s*["']?\s*(?:https?:)?\/\//i.test(cssText)) {
    return 'Remote HTTP(S) resources are not allowed in portable publisher stylesheets.';
  }
  if (/url\(\s*["']?\s*javascript:/i.test(cssText)) {
    return 'javascript: URLs are not allowed in publisher stylesheets.';
  }
  return undefined;
}

export function createPublisherExportStylesheet(
  fileName: string,
  cssText: string,
  addedAt = new Date().toISOString(),
): OmiPublisherExportStylesheet {
  const validationError = validatePublisherExportCss(cssText);
  if (validationError) throw new Error(validationError);
  return {
    model: 'OMI-PUBLISHER-EXPORT-STYLESHEET',
    version: '0.1.0',
    fileName: normalizeCssFileName(fileName, 'publisher'),
    mediaType: 'text/css',
    cssText,
    scope: 'publication-export',
    addedAt,
  };
}

export function createPublisherPrintStylesheet(
  fileName: string,
  cssText: string,
  addedAt = new Date().toISOString(),
): OmiPublisherPrintStylesheet {
  const validationError = validatePublisherExportCss(cssText);
  if (validationError) throw new Error(validationError);
  return {
    model: 'OMI-PUBLISHER-PRINT-STYLESHEET',
    version: '0.1.0',
    fileName: normalizeCssFileName(fileName, 'publisher-print'),
    mediaType: 'text/css',
    cssText,
    scope: 'print-pdf',
    addedAt,
  };
}

export function publisherStylesheetPackagePath(profile: OmiPublicationProfile): string | undefined {
  const stylesheet = profile.exportStylesheet;
  if (!stylesheet?.cssText.trim()) return undefined;
  return `styles/${normalizeCssFileName(stylesheet.fileName, 'publisher')}`;
}

export function publisherPrintStylesheetPackagePath(profile: OmiPublicationProfile): string | undefined {
  const stylesheet = profile.printStylesheet;
  if (!stylesheet?.cssText.trim()) return undefined;
  return `styles/${normalizeCssFileName(stylesheet.fileName, 'publisher-print')}`;
}

export function combinedPublisherPrintCss(profile: OmiPublicationProfile): string {
  return [profile.exportStylesheet?.cssText, profile.printStylesheet?.cssText]
    .map((value) => value?.trim() ?? '')
    .filter(Boolean)
    .join('\n\n');
}

function normalizeCssFileName(value: string, fallback: string): string {
  const stem = value
    .replace(/\.css$/i, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || fallback;
  return `${stem}.css`;
}
