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

## Cell rotation and writing direction

On desktop, focus a cell and open **Cell formatting**, or choose its row and
column in that panel. Rotation is independently selectable as 0°, 90° clockwise,
90° counterclockwise or 180°. Writing direction can follow the cell text
automatically or be explicitly left-to-right/right-to-left. A rotated cell's
text is edited in the panel, with its formatted appearance retained in the grid.
Each cell keeps its own settings in `cellFormats`, keyed by zero-based
`row:column`. Deleted rows/columns lose their formatting; new cells use defaults.
The renderer normalizes unknown rotation/direction values, and OMI save/reopen,
semantic HTML and PDF retain the supported settings. Quarter turns use vertical
writing mode with sideways glyphs so row height includes the rotated text.

## Mobile publication preview

The live publication editor shows the current print or HTML layout on native
Android/iOS and narrow screens (720 CSS pixels or less). Its menu includes a note
that full editing is available on desktop. View switching, scrolling and print
zoom remain available. Typography/page/proofing ribbons, cell-formatting controls
and editable front matter/body fields are replaced by a read-only preview.
Returning to a desktop viewport restores editing with the same manuscript and
formatting. The main manuscript editor remains available for ordinary text work.
