# Covers and title pages

Volumes and journal issues have a separate **Covers and title pages** workspace.
Open **Manuscript menu → Publishing → Publication editor → Covers and title pages**.
The author's volume workspace contains title metadata, contributors and structure;
edition typography is edited in Publishing. **Publication content** returns to
the structured print/HTML manuscript editor. Switching workspaces preserves both
the manuscript content and the independently edited publication pages. The cover
workspace remains editable on narrow screens and native mobile devices.
The manuscript chapters/articles, citations, note numbering and structured title
metadata remain separate from these publication pages.

The cover is one physical sheet with two independently editable faces. **Cover –
outside** shows back cover / spine / front cover. **Cover – inside** shows inside
front cover / binding area / inside back cover. Both use the same trim height and
width of `2 × trim width + spine width`. Fold lines and region labels are editing
guides and are omitted from exports. Both enabled faces precede the body in the
HTML/PDF print package; they are the two sides of one cover sheet, not extra
single-page covers. Title-matter pages retain their individual trim size.

The workspace has these tabs:

| Position | Page |
| --- | --- |
| Before content | Cover – outside (IV / spine / I) |
| Before content | Cover – inside (II / binding area / III) |
| Before content | Half-title |
| Before content | Series/title-matter page 2 |
| Before content | Title page |
| Before content | Imprint/title-matter page 4 |

All slots start disabled; old manuscripts therefore gain no extra pages.
Enabled empty slots remain blank pages. Disabling a page preserves its draft and
image. Changing the publication type to *Journal issue* is an edition setting;
it does not silently restructure the manuscript's articles.

Add independent **text frames** and **graphic frames** to either complete cover
face or a title-matter page. Cover coordinates and layers belong to the entire
sheet: one image or text frame may cross either or both fold lines without being
split or clipped at the folds. **New frame placement** supplies an initial
front/back/spine placement, or use **Whole cover sheet**. A spine text preset starts
rotated 90°. Select a frame on the sheet or in **Select frame**. Move and resize
its handles, or enter exact X/Y, width, height and rotation. **Measurement units**
selects millimetres (mm), picas (pc) or DTP points (pt) for frame/image geometry,
offsets, strokes, insets, page padding and spine width. It applies across page
tabs and is remembered on the device. Font size/leading remain labelled in points,
and rotation in degrees. Unit changes only change the displayed values; physical
sizes, stored millimetres, artwork and exported geometry stay intact. Unedited
converted fields do not round and rewrite the stored dimensions.

The DTP/CSS definitions are exact: 1 in = 25.4 mm = 72 pt = 6 pc, so 1 pc = 12 pt
([W3C absolute lengths](https://www.w3.org/TR/css-values-4/#absolute-lengths)).
Decimal values and negative offsets are supported.
Choose a rectangle, ellipse or custom polygon; polygon points can be dragged,
added and removed. Each frame has its own fill, stroke, typography and inset.
Frames may overlap freely. Use **Bring forward** / **Send backward** for one
layer at a time, **Bring to front** / **Send to back** for the outermost layers,
or choose an exact **Layer (1 = bottom)**. A covered frame can still be selected
from **Select frame**. Selection keeps the saved stacking order. The same order
is retained in OMI and HTML/PDF output. **Delete frame** removes the selected frame. Type and apply rich inline formatting directly inside a text frame; an
overflow message indicates that the text needs more space.

Upload PNG/JPEG/WebP artwork into a selected graphic frame, or paste/drop an image
file. **Edit image inside frame** switches to moving and resizing the artwork.
Its offset, dimensions, proportions and rotation are stored separately from the
frame. Changing the frame's shape or size clips the image without changing its
transform. Fit/fill actions explicitly re-fit the image. Frame-only artwork is
retained in OMI/revision snapshots and embedded in HTML packages and PDF input.

**Spine and paper** accepts a manual 0–100 mm spine (zero gives a simple fold), or
**Calculate spine from page count and paper**. The default page source is the last
measured print layout, when available, plus enabled half-title/series/title/imprint
pages; cover faces are excluded. The live count updates as the visible body is
repaginated. Hiding the body to edit the cover retains its last measured count.
Use a manual **Inside page count** for a printer-confirmed count including any
additional blank pages or signature padding.

The calculation is `ceil(inside pages / 2) × sheet thickness + binding allowance`.
Sheet thickness in mm is `grammage (g/m²) × bulk (cm³/g) / 1000`. The paper menu
offers manufacturer-specific uncoated, matt-coated and high-bulk book-paper
presets. Grammage, bulk, direct sheet thickness and binding allowance are editable;
editing paper values creates a custom paper. Preset target calipers come from
[Amber Graphic](https://www.arcticpaper.com/our-products/our-brands/amber/amber-graphic/),
[G-Print](https://www.arcticpaper.com/our-products/our-brands/g/g-print/) and
[Munken Print White](https://www.arcticpaper.com/our-products/our-brands/munken/munken-book-papers/munken-print-white/).
The selected paper, page-count source and latest count are retained in OMI/history.
Entering a manual spine width switches calculation off. An excessive calculated
width is reported instead of silently clamped. Printer binding/cover allowances
are supplied explicitly; paper presets are estimates rather than a binding specification.

Width changes move right-panel presets and center spine presets without scaling
their frames or artwork. Whole-sheet frames keep their absolute geometry. Review
artwork after changing binding dimensions. Old panel-based documents are projected
onto the complete sheet with rich text, images and transforms retained; the first
sheet edit saves that composition. Original panel drafts stay in the document,
and a saved sheet controls its own enabled state without reviving old panels.

Edit the original page text with rich inline formatting. Choose font family, point size, colors,
alignment, vertical placement and padding for each page. Upload PNG/JPEG/WebP
artwork and choose full-image or fill-page fitting. **Fill from publication
metadata** explicitly replaces only the selected page's text with a new snapshot
of existing title/imprint metadata; it does not invent publisher or copyright data.

Publication HTML and PDF input include enabled sheets/pages in the order above, using
the selected publication trim size and unnumbered named pages. Editorial PDF
omits them. A standalone study does not render volume pages. The page workspace
previews the full selected cover face or title page; the manuscript canvas still
paginates the body. Proof the complete generated PDF before printing.

The optional versioned extension `urn:omi:studio:publication-matter:1` stores page
drafts in OMI state and revision snapshots. Images use normal asset metadata and
verified binary payloads, including OMI/HTML packaging and recovery checks.
This is a Studio extension; the canonical OMI file-format version is unchanged.
These pages do not replace JATS article metadata or the Word/ODT scholarly-text
export paths. Printer-specific bleed, flaps, binding calculations and imposition remain
outside this page editor. Use the printer's final binding measurements for production.

## Title matter — dynamic metadata fields (shortcodes)

Open Publishing → Publication editor → Covers and title pages. Select a page or text frame, place the cursor, and choose Insert metadata field. You may also type a shortcode. Keep each token together with the same formatting. Enable Preview metadata fields to see resolved text; turn it off to edit the tokens.

| Shortcode | Value |
| --- | --- |
| `[omi:imprint]` | Imprint (colophon or publisher/address/contact, copyright and available identifiers) |
| `[omi:editorial-board]` | Editorial board / native public masthead, grouped by role |
| `[omi:authors]` | Publication authors |
| `[omi:contents]` | Contents: study authors and titles |
| `[omi:journal]` | Journal / series name |
| `[omi:publisher]` | Publisher |
| `[omi:address]` | Mailing address / publication place |
| `[omi:contact]` | Contact name |
| `[omi:title]` | Publication title |
| `[omi:volume]` | Volume |
| `[omi:number]` | Issue number |
| `[omi:year]` | Year |
| `[omi:issn]` | Print ISSN |
| `[omi:eissn]` | Electronic ISSN |
| `[omi:isbn]` | ISBN |
| `[omi:doi]` | DOI |

Save the layout as a publication template; the tokens are retained and resolve against the current publication in preview and HTML/PDF output, not against the previous issue.

For an existing OJS issue, reopen it from OJS and choose Refresh imprint and editorial board. This updates the imported snapshot without replacing the article text or layout. Native OJS masthead data requires the compatible connector; custom masthead plugins may need an adapter.

Missing or unknown fields remain visible as tokens and produce export diagnostics. Check the final PDF, especially frame overflow. Contents lists authors and titles, not page numbers. IDML, DOCX and ODT shortcode expansion is not established.

```text
IMPRINT
[omi:imprint]

Editorial board
[omi:editorial-board]

[omi:journal] [omi:volume]/[omi:number] ([omi:year])
```
