# Native IDML table export

The exporter writes editable `Table`, `Row`, `Column` and `Cell` objects in the existing DOM 8.0 story package. Cell coordinates are column:row; merged cells omit covered coordinates. Widths are relative to the exported story frame (or the enclosing cell for nested tables). Header and body counts, row height modes, local cell insets, fills, strokes, rotation and vertical alignment map to IDML properties. Cell text uses paragraph and character style ranges; source fonts and local colors are registered in package resources. The current table paragraph defaults are 11 pt and 10 pt (reduced size), rather than a dynamically inherited publication paragraph style.

## Explicit limitations

- Cell ordered lists and single-code-point bullets are emitted as native paragraph numbering/bullets, not text prefixes. Each structural list owns a separate named sequence, with start/restart, level, Roman/alphabetic/decimal formats, hanging indents and unnumbered continuation paragraphs. Compound parent-counter expressions and continuation across distinct structural lists produce explicit partial-fidelity diagnostics. Multi-character bullets fall back to literal labels. Native list reconstruction on import remains unsupported.
- Cell notes are projected into distinct `[T1]`, `[T2]` markers and note-list text. Adobe documents that native footnotes cannot be added to tables. The OMI document remains unchanged.
- Intra-row page splitting, explicit cell writing direction, some paragraph decorations and advanced character typography produce loss diagnostics. Exact row height can overset text. InDesign's shared border conflict resolution can differ from the Studio.
- Native table import is available separately; linked named table/cell style inheritance, multi-frame pagination and visual verification in Adobe InDesign remain open.

## References

- https://idml.paged.media/tables/the-table-model/
- https://idml.paged.media/tables/rows-columns-cells/
- https://idml.paged.media/styles/table-and-cell-styles/
- https://idml.paged.media/typography/lists-keep-span/
- https://helpx.adobe.com/indesign/desktop/add-tables-and-data/create-tables/add-content-to-a-table.html

Regression tests inspect the actual stored ZIP XML, including native geometry, nested content order, style and color references, and public-export filtering. They do not substitute for opening and rendering the package in InDesign.
