# Responsive manuscript tables

Tables in the manuscript and live publication editors use the available content
width. Cell text wraps and accepts explicit line breaks. Drag a boundary in the
first row to resize its two neighboring columns; focus the boundary and use the
left/right arrow keys to resize with a keyboard. Relative column widths survive
OMI save/reopen and carry through to HTML and PDF output.

The table font-size control selects the body size or one point smaller (the
default). The live publication view scales that point with its zoom setting.
Rows grow with their content; cells also offer a vertical resize affordance in
browsers without automatic content sizing.

Small tables move as a unit in the live print view. Tables taller than a page
continue between rows. Screen spacers are temporary presentation state; they do
not become manuscript text, stored page breaks or exported table rows. HTML and
PDF use semantic `thead`/`tbody` tables, wrapping cells, and automatic page
fragmentation with repeated headers. A row is kept together where possible;
a row taller than a printed page is left to the print engine's fragmentation.
Custom publisher CSS can override these layout defaults.

Validation: model and OMI round-trip tests in `tests/table-layout.test.ts`;
browser checks for multiline editing, keyboard/pointer resizing, responsive
width and pagination at multiple zoom settings in `e2e/table-layout.spec.ts`.
