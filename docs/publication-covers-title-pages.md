# Covers and title pages

Volumes and journal issues have a separate **Covers and title pages** workspace.
Open it from the volume's metadata tabs or the live publication editor's ribbon.
The manuscript chapters/articles, citations, note numbering and structured title
metadata remain separate from these publication pages.

Each page has its own content, enabled state, image and appearance:

| Position | Page |
| --- | --- |
| Before content | Front cover, outside (I) |
| Before content | Front cover, inside (II) |
| Before content | Half-title |
| Before content | Series/title-matter page 2 |
| Before content | Title page |
| Before content | Imprint/title-matter page 4 |
| After content | Back cover, inside (III) |
| After content | Back cover, outside (IV) |

All slots start disabled; old manuscripts therefore gain no extra pages.
Enabled empty slots remain blank pages. Disabling a page preserves its draft and
image. Changing the publication type to *Journal issue* is an edition setting;
it does not silently restructure the manuscript's articles.

Edit text with rich inline formatting. Choose font family, point size, colors,
alignment, vertical placement and padding for each page. Upload PNG/JPEG/WebP
artwork and choose full-image or fill-page fitting. **Fill from publication
metadata** explicitly replaces only the selected page's text with a new snapshot
of existing title/imprint metadata; it does not invent publisher or copyright data.

Publication HTML and PDF input include enabled pages in the order above, using
the selected publication trim size and unnumbered named pages. Editorial PDF
omits them. A standalone study does not render volume pages. The page workspace
previews the selected page separately; the existing live manuscript canvas still
paginates the body. Proof the complete generated PDF before printing.

The optional versioned extension `urn:omi:studio:publication-matter:1` stores page
drafts in OMI state and revision snapshots. Images use normal asset metadata and
verified binary payloads, including OMI/HTML packaging and recovery checks.
This is a Studio extension; the canonical OMI file-format version is unchanged.
These pages do not replace JATS article metadata or the Word/ODT scholarly-text
export paths. Printer-specific cover spreads, spine widths and imposition are
outside this individual-page editor.
