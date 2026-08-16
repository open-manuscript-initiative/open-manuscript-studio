import { combinedPublisherPrintCss } from '../model/publisherExportStyle';
import {
  profileSupportsOutput,
  resolvePublicationProfile,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import type { OmiManuscript } from '../types/omi';
import { renderHtmlArticle } from './exportHtml';

/**
 * Builds the isolated print document used by browser PDF output.
 *
 * Layer order is intentional:
 * 1. semantic HTML renderer/profile CSS;
 * 2. OMI print defaults derived from the publication profile;
 * 3. general publisher export CSS;
 * 4. publisher print/PDF CSS.
 *
 * Publisher print CSS therefore has final authority and may override the
 * generated @page size/margins or add Paged Media rules for print engines that
 * support them.
 */
export function buildPdfPrintDocument(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
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

  a {
    color: inherit;
  }
}
`.trim();

  const publisherCss = combinedPublisherPrintCss(profile);
  const stylesheet = [generatedPrintCss, publisherCss]
    .filter((value) => value.trim())
    .join('\n\n');

  return result.html.replace(
    '</head>',
    `  <meta name="omi-output-format" content="pdf-print">\n  <style data-omi-print-style>\n${stylesheet}\n  </style>\n</head>`,
  );
}

/**
 * Opens the publication-rendered HTML in a dedicated print window. Browsers
 * can save this print job as PDF without adding a large client-side PDF
 * dependency. The publisher profile's print CSS remains authoritative.
 */
export function openPdfPrintView(manuscript: OmiManuscript): void {
  const printable = buildPdfPrintDocument(manuscript);
  const target = window.open('', '_blank', 'noopener,noreferrer');
  if (!target) throw new Error('The browser blocked the PDF print window.');
  target.document.open();
  target.document.write(printable);
  target.document.close();
  target.focus();
  target.setTimeout(() => target.print(), 250);
}
