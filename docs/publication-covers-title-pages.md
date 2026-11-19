# Covers and title pages

Volumes and journal issues have a separate **Covers and title pages** workspace.
Open it from the volume's metadata tabs or the live publication editor's ribbon.
The manuscript chapters/articles, citations, note numbering and structured title
metadata remain separate from these publication pages.

Each page has its own content, enabled state, image and appearance:

| Position | Page |
| --- | --- |
| Before content | Front cover, outside (I) |
| Outside cover spread, when enabled | Spine, with a configurable 1–100 mm width |
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

Add independent **text frames** and **graphic frames** to any cover, title-matter
page or spine. Select a frame on the page or in **Select frame**. Move and resize
its handles, or enter X/Y, width, height and rotation in millimetres/degrees.
Choose a rectangle, ellipse or custom polygon; polygon points can be dragged,
added and removed. Each frame has its own fill, stroke, typography and inset.
Use **Bring to front**, **Send to back** and **Delete frame** to manage overlapping
frames. Type and apply rich inline formatting directly inside a text frame; an
overflow message indicates that the text needs more space.

Upload PNG/JPEG/WebP artwork into a selected graphic frame, or paste/drop an image
file. **Edit image inside frame** switches to moving and resizing the artwork.
Its offset, dimensions, proportions and rotation are stored separately from the
frame. Changing the frame's shape or size clips the image without changing its
transform. Fit/fill actions explicitly re-fit the image. Frame-only artwork is
retained in OMI/revision snapshots and embedded in HTML packages and PDF input.

Select **Spine** to set the spine width. New spine text frames start rotated 90°;
the rotation field supports either direction and arbitrary angles. Enabling the
spine changes the exterior cover output to one spread: back cover on the left,
spine in the middle, front cover on the right. Its size is twice the publication
trim width plus the spine width, by the trim height. Disabled outside panels
remain blank in that spread. Disabling the spine restores separate cover pages
and retains its draft. Changing spine width preserves manually placed frames;
review their positions after changing the binding dimensions. Legacy files
without a spine remain compatible.

Edit the original page text with rich inline formatting. Choose font family, point size, colors,
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
export paths. Printer-specific bleed, flaps, binding calculations and imposition remain
outside this page editor. Enter the spine width supplied by the printer.
