# Publication frame layout

Open **Manuscript menu → Live publication editor → Frame layout**. The continuous
print/HTML editor remains available in the neighboring mode. On desktop, add
text frames or graphic frames; native mobile and narrow screens show a read-only
preview of the same layout.

## Text and graphic frames

A frame has a page, millimeter position and dimensions, and an arbitrary numeric
rotation angle. Drag its name handle to move it, or its corner handle to resize
it. A focused name handle supports arrow-key movement; the inspector also exposes
numeric controls for precise geometry. Pages have their own dimensions/count.

Graphic frames reference existing manuscript images, charts, tables, equations
or scores. Add the graphic to the manuscript first, then select it as the frame
source. Source objects and their identifiers remain in the structured manuscript.
Chart exports retain the rendered vector chart rather than the semantic HTML
renderer's source-data table. Image exports reuse the existing integrity-checked
self-contained PDF asset pipeline.

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
