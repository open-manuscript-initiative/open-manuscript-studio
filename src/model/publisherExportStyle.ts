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

declare module './publicationProfile' {
  interface OmiPublicationProfile {
    exportStylesheet?: OmiPublisherExportStylesheet;
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
    fileName: normalizeCssFileName(fileName),
    mediaType: 'text/css',
    cssText,
    scope: 'publication-export',
    addedAt,
  };
}

export function publisherStylesheetPackagePath(profile: OmiPublicationProfile): string | undefined {
  const stylesheet = profile.exportStylesheet;
  if (!stylesheet?.cssText.trim()) return undefined;
  return `styles/${normalizeCssFileName(stylesheet.fileName)}`;
}

function normalizeCssFileName(value: string): string {
  const stem = value
    .replace(/\.css$/i, '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 96) || 'publisher';
  return `${stem}.css`;
}
