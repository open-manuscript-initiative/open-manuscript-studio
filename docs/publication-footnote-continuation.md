# Footnote page continuation in publication styles

The **Publication editor → Paragraph styles → Note → Keep options** panel
contains **Allow footnote to continue on the next page**. The option is part of
the saved paragraph style and is inherited and normalized with the rest of
the style properties.

- **Enabled (default):** long footnotes may continue on later pages in measured
  whole lines. The note number remains at the first fragment; continued
  fragments show only the remaining text.
- **Disabled:** if the full note group fits within the next page's reserved
  footnote area but not the current page's remaining footnote area, its
  reference line moves to the next page so the note can stay together.
- **Oversized notes:** when a note cannot fit into the footnote area of a single
  page (or an inseparable line introduces too many notes), the renderer falls
  back to line-by-line continuation instead of truncating content.
- The preference is applied to the live paginated print editor with both normal
  pages and named page styles. The paged PDF export also requests
  `break-inside: avoid-page` for footnotes when continuation is disabled.
  Actual PDF pagination depends on the paged-media engine and should be
  checked after export. Continuous HTML notes remain semantic and linked.

The preference affects **print layout** and never changes the manuscript's
note text, anchors, numbering or order. It does not replace the ordinary
paragraph **Keep lines together** rule, which controls manuscript paragraphs.
