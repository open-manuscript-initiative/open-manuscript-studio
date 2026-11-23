# Publication frame layout

Open **Manuscript menu → Publishing → Publication editor → Frames and page styles**.
The frame inspector expands alongside the structured print/HTML content editor. On desktop, add
text frames or graphic frames; native mobile and narrow screens show a read-only
preview of the same layout.

## Text and graphic frames

A frame has a page, millimeter position and dimensions, and an arbitrary numeric
rotation angle. Drag its name handle to move it, or its corner handle to resize
it. A focused name handle supports arrow-key movement; the inspector also exposes
numeric controls for precise geometry. Pages have their own dimensions/count.
The shared **Measurement units** selector supports mm, picas and DTP points for
page/frame geometry, margins, insets, strokes and image transforms. It uses the
same device preference as **Covers and title pages**. Frames can overlap: choose
an exact layer or move the selected frame forward/backward, to the front/back.
Selecting a frame does not raise it; the saved order also drives frame HTML/PDF.
Cover/title-matter/spine pages have directly editable rich text and independent
image frames in the **Covers and title pages** workspace of this same editor.

Graphic frames reference existing manuscript images, charts, tables, equations
or scores. Add the graphic to the manuscript first, then select it as the frame
source. Source objects and their identifiers remain in the structured manuscript.
Chart exports retain the rendered vector chart rather than the semantic HTML
renderer's source-data table. Image exports reuse the existing integrity-checked
self-contained PDF asset pipeline.

## Charts in ordinary HTML publication exports

In addition to fixed-layout graphic frames, the regular scholarly HTML exporter
renders manuscript charts directly as **inline SVG**. It uses the same drawing
component and the same editable source data as the Studio preview. The HTML
document is self-contained and does not load chart libraries or run scripts.
All ten supported chart families, the four palette presets, and the saved
grid/legend/value-label settings are carried through.

Each figure retains its stable manuscript block ID, caption and an accessible
expandable source-data table. Table headers identify both columns and rows, and
the summary is localized in English, Hungarian and German. The full source
table is retained even if a preview limits the number of visibly plotted
categories. If data cannot be rendered as numeric chart values, HTML falls back
to the source table and emits a diagnostic rather than inventing a figure.
The image is scalable and remains vector-based in print; no separate raster
chart assets are required.

JATS continues to preserve the semantic OMI chart JSON as media data and
diagnoses the lack of a standardized chart graphic; JATS graphical rendering
is not asserted by this HTML-export change.

`tests/html-export.test.ts` exercises all chart families, source table access,
markup safety, empty/non-numeric values, and determinism without modifying the
manuscript.

A text frame belongs to a story. Edit the story in the inspector; the text flows
through its linked frames. **Copy manuscript text into story** explicitly copies
plain text from the manuscript. This first version does not migrate inline rich
formatting, citations or footnotes into frame stories. They remain intact in the
continuous scholarly manuscript. This mode therefore has its own explicit print
and HTML export actions, separate from regular scholarly publication exports.

## Shared and individual formatting

Frames use named shared styles. Editing a shared style updates every frame using
it. Create another shared style to format a group differently. Local overrides
change one frame's font, size, leading, alignment, inset, colors or outline without
changing its shared style. Turning local overrides off restores inheritance.

## Linking and splitting

Link a text-chain tail to another chain's first frame. Both story strings are
concatenated without inserting or deleting characters. Flow continues according
to the actual font metrics and available shape intervals in each frame.

**Unlink continuation** splits the current story at the last character consumed
by the selected frame. Its continuation becomes an independent story and chain,
retaining its frame geometry and styling. Relinking preserves the full text.
Cycles, multiple incoming links and disconnected frames sharing one story are
rejected. Deleting a frame reconnects its neighbors and retains the whole story;
a story with no frames can be reassigned through **Retained story**.

## Frame shapes and text flow

Choose rectangle, ellipse or an editable polygon. Polygon vertices are percentage
coordinates; drag the outline handles or edit individual X/Y values, and add or
remove vertices. Rotation applies to the outline and its contents together.
This version supports polygon outlines with up to 128 vertices, rather than
Bézier curve handles. Ellipses provide a smooth curved outline.

Text is laid out inside the shape, not merely clipped to it. The flow engine
intersects the horizontal intervals across each full line-height band, including
multiple intervals in a concave polygon. It wraps on grapheme boundaries and
prefers whitespace when available, preserving Unicode clusters and source offsets.
Font loading and changes to styles, geometry, links or stories recompute the flow.

## Overflow, saving and output

Any unplaced story text is reported as overflow. Printing/downloading is blocked
until all story text fits and all graphic sources exist. Nothing is silently
truncated. A frame can extend outside a page for manual composition; the final
output is clipped to the physical page boundary.

The layout is stored in the manuscript's namespaced extension
`urn:omi:studio:publication-frames:1`, profile `studio-publication-frames-0.1`.
It is a Studio presentation extension, not a new standardized OMI-SPEC model.
Geometry, styles, stories and links survive OMI save/reopen and participate in
pending changes and revision checkpoints. Rendered lines/offsets are computed
presentation state and are not saved as stale page caches.

**Print frames / save PDF** opens the frame document in an isolated print window.
**Download frame HTML** creates a self-contained document with fixed page geometry,
vector outlines/charts and embedded images. Installed font families are used;
viewing the HTML on another machine requires the same fonts for the same metrics.
PDF is the stable format for distributing the final fixed layout.

## Validation

`tests/publication-frames.test.ts` covers flow, linking/splitting, deletion without
text loss, shared/local styles, ellipse/concave polygon intervals, Unicode clusters,
invalid graphs/geometry, OMI round trips, output preflight and markup escaping.
`e2e/publication-frames.spec.ts` exercises pointer moves/resizes, rotated outline
point editing, story operations, style inheritance, source graphics, exported SVG
charts, PDF generation and mobile preview.

## Named page styles and page operations

The **Page styles** panel assigns a named style to each physical page. A style
contains page width/height, working margins, background and running-header rules.
Editing a shared page style changes all pages using it. **New page style** clones
the current style and assigns the copy to the selected page, allowing individual
page formatting. Existing frames keep their explicit positions; margin guides
show the working area and new frames start inside it.

Choose **Style for new page**, then **Add page** to insert immediately after the
selected page. Later frame placements are shifted to their corresponding page.
**Delete selected page** removes its frame placements and reconnects surviving
text chains. Full story text and original graphic sources remain available;
new overflow is reported and retained stories can be reassigned to a new frame.
At least one page remains in the publication.

Running headers support separate left/center/right text, an optional even-page
variant, first-page visibility, font, size, color, vertical position and height.
`{title}`, `{page}`, `{pages}` and `{style}` insert the document title, displayed
page number, page count and page-style name. `{articleTitle}` and `{pageNumber}`
are supported aliases. The first displayed page number is configurable. Headers
are rendered as text, so literal markup in a header cannot become executable HTML.

Pages may use different sizes/orientations in one document. Export assigns named
CSS `@page` rules per style; the preview and PDF use each page's own geometry.
Legacy page-count-only layouts remain readable and gain explicit page/style
assignments on their first page-style edit.

## Graphic content inside its frame

A graphic frame and its content now have independent geometry. **Graphic content**
controls the element's width/height, offsets and rotation relative to the frame.
**Keep graphic proportions** couples dimension changes; turning it off permits
independent horizontal/vertical scaling. Re-enabling the lock preserves the
currently chosen ratio, including an intentionally distorted ratio.

The canvas includes separate handles for moving and resizing the graphic inside
its frame. Numeric controls remain available for precision. The frame's shape,
position, size and rotation are unaffected by these content operations, and the
content remains clipped to the frame outline. Frame and content rotations compose.
The same transforms and clipping are used in mobile preview, HTML and PDF output.

**Fit graphic to frame** restores automatic proportional fitting. **Fill frame
proportionally** covers the whole frame with a centered crop. After an explicit
content transform, resizing the outer frame retains the content's independent
geometry. Replacing a frame's graphic source resets its content transform.


## Print alignment and language-based hyphenation

Print text frames now support left, center, right and justified alignment. On
justified lines the measured remaining width is distributed across word spaces;
paragraph endings and explicit line breaks keep their natural spacing. Shared
styles and local overrides both support justification. The cover and title-page
text frames support it too. Responsive HTML retains left/center/right alignment.

Frame hyphenation is enabled by default. It follows the manuscript language,
with an optional BCP 47 text-language override on each shared/local frame style
(for example `hu-HU`, `en-GB` or `de-DE`). Only the used language dictionaries
are loaded. Hyphens appear only at dictionary break positions which fit in the
measured line, including the width of the hyphen. Turning hyphenation off leaves
word wrapping available. Unknown languages receive no guessed hyphens.

Preview and frame PDF/HTML export use the same line compositor and dictionary
patterns. The HTML download of frames is a fixed print proof, distinct from the
responsive HTML publication. Generated hyphens and expanded word spaces are
presentation data; story text, source offsets, frame links and OMI content stay
unchanged. Paragraph-style language overrides and disabled hyphenation are also
respected by the continuous print export, including inline language spans.

## Semantic text styles and point presets

The publication editor's **Paragraph styles** panel includes automatic styles for
body text, title, subtitle, author, motto, abstract, keywords, headings, quotations,
notes, citations, citations in notes, bibliography and captions. These styles drive
the live canvas and HTML/PDF export. Built-in names follow the interface language
until renamed. Existing custom names, IDs and overrides survive migration.

Use **New paragraph style** or **Duplicate** to create an independent named style.
A duplicate inherits formatting without claiming the source style's automatic
semantic role. Built-in role styles can be edited and renamed; custom styles can
be deleted. Empty language settings inherit the base style and then the manuscript
language. Explicit inline language annotations keep precedence for print hyphenation.

Font-size and leading fields offer common point values through native dropdown
suggestions and also accept custom numeric values. Leading is the distance between
baselines in points. The same editable point controls are available in text frames
and cover text.

**Citation in notes** inherits explicit typography from **Citation**; unspecified
values inherit the surrounding note. Its first/subsequent citation format selectors
inherit the publication profile unless overridden. These presentation preferences
are saved with the publication style and do not rewrite note text or citation data.
