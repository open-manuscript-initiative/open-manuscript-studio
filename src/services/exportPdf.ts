import { renderHtmlArticle } from './exportHtml';
import type { OmiManuscript } from '../types/omi';

/**
 * Opens the publication-rendered HTML in a dedicated print window.
 * Browsers can save this print job as PDF without adding a large client-side
 * PDF dependency. Publication profile print CSS remains authoritative.
 */
export function openPdfPrintView(manuscript: OmiManuscript): void {
  const result = renderHtmlArticle(manuscript);
  if (!result.validForExport) {
    throw new Error(
      result.diagnostics
        .filter((item) => item.severity === 'error')
        .map((item) => item.message)
        .join('\n') || 'The manuscript is not ready for PDF output.',
    );
  }

  const printable = result.html.replace(
    '</head>',
    `<style>@media print{@page{size:${result.context.profile.rules.layout.pageSize};margin:${result.context.profile.rules.layout.marginMm.top}mm ${result.context.profile.rules.layout.marginMm.right}mm ${result.context.profile.rules.layout.marginMm.bottom}mm ${result.context.profile.rules.layout.marginMm.left}mm}body{margin:0}.omi-scholarly-article{max-width:none}}</style></head>`,
  );
  const target = window.open('', '_blank', 'noopener,noreferrer');
  if (!target) throw new Error('The browser blocked the PDF print window.');
  target.document.open();
  target.document.write(printable);
  target.document.close();
  target.focus();
  target.setTimeout(() => target.print(), 250);
}
