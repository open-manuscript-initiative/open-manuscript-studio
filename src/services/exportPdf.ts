import { combinedPublisherPrintCss } from '../model/publisherExportStyle';
import {
  profileSupportsOutput,
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { renderHtmlArticle } from './exportHtml';

export type PdfExportMode = 'print' | 'interactive';

/**
 * Builds the isolated print document used by browser PDF output.
 *
 * Layer order is intentional:
 * 1. semantic HTML renderer/profile CSS;
 * 2. OMI print defaults derived from the publication profile;
 * 3. general publisher export CSS;
 * 4. publisher print/PDF CSS;
 * 5. PDF-mode interaction semantics, limited to link presentation.
 *
 * The publisher profile therefore remains authoritative for publication
 * typography and page geometry. The final mode layer only guarantees that an
 * interactive PDF exposes its retained links visibly. Print-mode links are
 * removed from the generated HTML altogether.
 */
export function buildPdfPrintDocument(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
  mode: PdfExportMode = 'print',
): string {
  if (!profileSupportsOutput(profile, 'pdf')) {
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

  const publisherCss = combinedPublisherPrintCss(profile);
  const modeCss = mode === 'interactive'
    ? `
@media print {
  body.omi-pdf-mode-interactive a[href] {
    color: inherit;
    text-decoration: underline;
    text-decoration-thickness: .08em;
    text-underline-offset: .12em;
  }
}
`.trim()
    : '';
  const stylesheet = [generatedPrintCss, publisherCss, modeCss]
    .filter((value) => value.trim())
    .join('\n\n');

  const outputFormat = mode === 'interactive' ? 'pdf-interactive' : 'pdf-print';
  const bodyClass = mode === 'interactive'
    ? 'omi-pdf-output omi-pdf-mode-interactive'
    : 'omi-pdf-output omi-pdf-mode-print';
  const sourceHtml = mode === 'print'
    ? stripPdfHyperlinks(result.html)
    : result.html;
  const modeAnnotatedHtml = sourceHtml.replace(
    '<body>',
    `<body class="${bodyClass}" data-omi-pdf-mode="${mode}">`,
  );

  return modeAnnotatedHtml.replace(
    '</head>',
    `  <meta name="omi-output-format" content="${outputFormat}">\n  <meta name="omi-pdf-mode" content="${mode}">\n  <style data-omi-print-style>\n${stylesheet}\n  </style>\n</head>`,
  );
}

/**
 * Opens the publication-rendered HTML in a dedicated print window. Browsers
 * can save this print job as PDF without adding a large client-side PDF
 * dependency. The publisher profile's print CSS remains authoritative.
 *
 * Print mode produces a press-oriented document without active hyperlinks.
 * Interactive mode retains internal and external anchors so Chromium-based PDF
 * writers can preserve them as clickable PDF link annotations.
 */
export function openPdfPrintView(
  manuscript: OmiManuscript,
  mode: PdfExportMode = 'print',
): void {
  const printable = buildPdfPrintDocument(manuscript, undefined, mode);
  const target = window.open('', '_blank');
  if (!target) throw new Error('The browser blocked the PDF print window.');
  target.opener = null;
  target.document.open();
  target.document.write(printable);
  target.document.close();
  target.document.title = pdfDocumentTitle(manuscript, mode);
  target.focus();
  target.setTimeout(() => target.print(), 250);
}

export function pdfDocumentTitle(
  manuscript: Pick<OmiManuscript, 'title' | 'id'>,
  mode: PdfExportMode = 'print',
): string {
  const title = manuscript.title.trim() || manuscript.id || 'manuscript';
  return mode === 'interactive' ? `${title} – interactive` : title;
}

function stripPdfHyperlinks(html: string): string {
  return html.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
}
