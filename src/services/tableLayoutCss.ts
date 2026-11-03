/** Shared by semantic HTML, browser print, publication styles and PDF source. */
export const TABLE_LAYOUT_CSS = `
figure.scholarly-table, .scholarly-table table {
  break-inside: auto; page-break-inside: auto; min-width: 0; max-width: 100%;
}
.scholarly-table table {
  width: 100%; table-layout: fixed; border-collapse: collapse;
  font-size: calc(1em - var(--omi-table-font-reduction, 1) * 1pt); line-height: 1.3;
}
.scholarly-table th, .scholarly-table td {
  min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; vertical-align: top;
}
.scholarly-table thead { display: table-header-group; break-inside: avoid; }
.scholarly-table tbody { break-inside: auto; page-break-inside: auto; }
.scholarly-table tr { break-inside: avoid; page-break-inside: avoid; }
.scholarly-table figcaption { break-inside: avoid; }
.scholarly-table figcaption:first-child { break-after: avoid; }
.scholarly-table figcaption:last-child { break-before: avoid; }
`;
