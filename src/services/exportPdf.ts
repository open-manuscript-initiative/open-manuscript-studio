import { combinedPublisherPrintCss } from '../model/publisherExportStyle';
import {
  profileSupportsOutput,
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { renderHtmlArticle } from './exportHtml';

export type PdfExportMode = 'print' | 'interactive';
export type PdfContentMode = 'editorial' | 'publication';

/**
 * Builds the isolated print document used by browser PDF output.
 *
 * Publication mode keeps the selected publication profile authoritative for
 * typography and page geometry. Editorial mode deliberately removes that
 * presentation layer and applies a neutral manuscript stylesheet while keeping
 * the semantic article structure, notes, references and scholarly objects.
 *
 * PDF interaction mode is independent from content mode: print output removes
 * active hyperlinks, while interactive output retains them.
 */
export function buildPdfPrintDocument(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
  mode: PdfExportMode = 'print',
  contentMode: PdfContentMode = 'publication',
): string {
  const normalizedMode = normalizePdfExportMode(mode);
  const normalizedContentMode = normalizePdfContentMode(contentMode);

  if (normalizedContentMode === 'publication' && !profileSupportsOutput(profile, 'pdf')) {
    throw new Error(
      `Publication profile ${profile.id}@${profile.version} does not declare PDF output support.`,
    );
  }

  const result = renderHtmlArticle(manuscript, profile);
  const fatalDiagnostics = result.diagnostics.filter(
    (item) =>
      item.severity === 'error' &&
      item.code !== 'profile-does-not-support-html',
  );
  if (fatalDiagnostics.length) {
    throw new Error(
      fatalDiagnostics.map((item) => item.message).join('\n') ||
        'The manuscript is not ready for PDF output.',
    );
  }

  const stylesheet = normalizedContentMode === 'publication'
    ? buildPublicationPrintStylesheet(profile)
    : buildEditorialPrintStylesheet();
  const sourceHtml = normalizedContentMode === 'publication'
    ? result.html
    : stripEmbeddedProfileStyle(result.html);
  const styledHtml = sourceHtml.replace(
    '</head>',
    `  <style data-omi-print-style data-omi-pdf-content="${normalizedContentMode}">\n${stylesheet}\n  </style>\n</head>`,
  );

  return applyPdfInteractionMode(styledHtml, normalizedMode, normalizedContentMode);
}

/**
 * Applies the link semantics and metadata shared by profile-based and live
 * publication-style PDF paths.
 */
export function applyPdfInteractionMode(
  html: string,
  mode: PdfExportMode,
  contentMode: PdfContentMode = 'publication',
): string {
  const normalizedMode = normalizePdfExportMode(mode);
  const normalizedContentMode = normalizePdfContentMode(contentMode);
  const outputFormat = normalizedMode === 'interactive' ? 'pdf-interactive' : 'pdf-print';
  const bodyClass = [
    'omi-pdf-output',
    `omi-pdf-mode-${normalizedMode}`,
    `omi-pdf-content-${normalizedContentMode}`,
  ].join(' ');
  const sourceHtml = normalizedMode === 'print' ? stripPdfHyperlinks(html) : html;
  const modeAnnotatedHtml = annotatePdfBody(
    sourceHtml,
    bodyClass,
    normalizedMode,
    normalizedContentMode,
  );
  const interactionCss = normalizedMode === 'interactive'
    ? `
@media print {
  body[data-omi-pdf-mode="interactive"] a[href] {
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: .08em;
    text-underline-offset: .12em;
  }
}
`.trim()
    : '';
  const interactionStyle = interactionCss
    ? `  <style data-omi-pdf-interaction-style>\n${interactionCss}\n  </style>\n`
    : '';

  return modeAnnotatedHtml.replace(
    '</head>',
    `  <meta name="omi-output-format" content="${outputFormat}">\n  <meta name="omi-pdf-mode" content="${normalizedMode}">\n  <meta name="omi-pdf-content" content="${normalizedContentMode}">\n${interactionStyle}</head>`,
  );
}

/**
 * Opens the selected manuscript representation in a dedicated print window.
 * Browsers can print it directly or save the same print job as PDF.
 *
 * The generated HTML is navigated through an isolated Blob URL instead of
 * being reinterpreted through document.write(). This keeps DOM-derived selector
 * values away from HTML-writing sinks and preserves the popup's opener isolation.
 */
export function openPdfPrintView(
  manuscript: OmiManuscript,
  mode: PdfExportMode = 'print',
  contentMode: PdfContentMode = 'publication',
): void {
  const normalizedMode = normalizePdfExportMode(mode);
  const normalizedContentMode = normalizePdfContentMode(contentMode);
  const printable = buildPdfPrintDocument(
    manuscript,
    undefined,
    normalizedMode,
    normalizedContentMode,
  );
  const target = window.open('', '_blank');
  if (!target) throw new Error('The browser blocked the PDF print window.');
  target.opener = null;

  const printUrl = URL.createObjectURL(
    new Blob([printable], { type: 'text/html;charset=utf-8' }),
  );
  target.addEventListener('load', () => {
    target.document.title = pdfDocumentTitle(manuscript, normalizedMode);
    target.focus();
    target.setTimeout(() => {
      try {
        target.print();
      } finally {
        URL.revokeObjectURL(printUrl);
      }
    }, 250);
  }, { once: true });
  target.location.replace(printUrl);
}

export function pdfDocumentTitle(
  manuscript: Pick<OmiManuscript, 'title' | 'id'>,
  mode: PdfExportMode = 'print',
): string {
  const title = manuscript.title.trim() || manuscript.id || 'manuscript';
  return normalizePdfExportMode(mode) === 'interactive' ? `${title} – interactive` : title;
}

function normalizePdfExportMode(mode: PdfExportMode): PdfExportMode {
  return mode === 'interactive' ? 'interactive' : 'print';
}

function normalizePdfContentMode(contentMode: PdfContentMode): PdfContentMode {
  return contentMode === 'editorial' ? 'editorial' : 'publication';
}

function buildPublicationPrintStylesheet(profile: OmiPublicationProfile): string {
  const layout = profile.rules.layout;
  const generatedPrintCss = `
@page {
  size: ${layout.pageSize};
  margin: ${layout.marginMm.top}mm ${layout.marginMm.right}mm ${layout.marginMm.bottom}mm ${layout.marginMm.left}mm;
}

@media print {
  html, body {
    margin: 0;
    padding: 0;
    background: #fff;
  }

  .omi-scholarly-article {
    max-width: none;
    width: auto;
    margin: 0;
    padding: 0;
    box-shadow: none;
  }

  h1, h2, h3, h4, h5, h6 {
    break-after: avoid;
    page-break-after: avoid;
  }

  p, li {
    orphans: 3;
    widows: 3;
  }

  figure, table, blockquote, pre, .article-contributors,
  .article-abstract, .article-keywords, .bibliography-entry {
    break-inside: avoid;
    page-break-inside: avoid;
  }
}
`.trim();

  return [generatedPrintCss, combinedPublisherPrintCss(profile)]
    .filter((value) => value.trim())
    .join('\n\n');
}

function buildEditorialPrintStylesheet(): string {
  return `
@page {
  size: auto;
  margin: 20mm;
}

html, body {
  margin: 0;
  padding: 0;
  background: #fff;
  color: #111;
}

body {
  font-family: Georgia, "Times New Roman", serif;
  font-size: 11pt;
  line-height: 1.5;
}

.omi-scholarly-article {
  box-sizing: border-box;
  max-width: 180mm;
  width: auto;
  margin: 0 auto;
  padding: 0;
  box-shadow: none;
}

.article-front {
  margin: 0 0 2em;
}

h1 {
  font-size: 20pt;
  line-height: 1.2;
  margin: 0 0 .8em;
}

h2 {
  font-size: 15pt;
  line-height: 1.25;
  margin: 1.5em 0 .5em;
}

h3 {
  font-size: 12pt;
  line-height: 1.3;
  margin: 1.25em 0 .45em;
}

p, li {
  orphans: 3;
  widows: 3;
}

p {
  margin: .55em 0;
  text-indent: 0;
}

h1, h2, h3, h4, h5, h6 {
  break-after: avoid;
  page-break-after: avoid;
}

figure, table, blockquote, pre, .article-contributors,
.article-abstract, .article-keywords, .bibliography-entry {
  break-inside: avoid;
  page-break-inside: avoid;
}

img, svg, table {
  max-width: 100%;
}

pre, code {
  font-family: ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace;
}

.article-notes, .footnotes, [role="doc-endnotes"] {
  font-size: 9.5pt;
  line-height: 1.4;
}

@media print {
  .omi-scholarly-article {
    max-width: none;
  }
}
`.trim();
}

function stripEmbeddedProfileStyle(html: string): string {
  return html.replace(/<style>\s*[\s\S]*?<\/style>/i, '');
}

function stripPdfHyperlinks(html: string): string {
  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
}

function annotatePdfBody(
  html: string,
  bodyClass: string,
  mode: PdfExportMode,
  contentMode: PdfContentMode,
): string {
  return html.replace(/<body\b([^>]*)>/i, (_match, attributes: string) => {
    const classPattern = /\sclass=(['"])(.*?)\1/i;
    const classMatch = attributes.match(classPattern);
    const nextAttributes = classMatch
      ? attributes.replace(
          classPattern,
          ` class=${classMatch[1]}${classMatch[2]} ${bodyClass}${classMatch[1]}`,
        )
      : `${attributes} class="${bodyClass}"`;
    return `<body${nextAttributes} data-omi-pdf-mode="${mode}" data-omi-pdf-content="${contentMode}">`;
  });
}
