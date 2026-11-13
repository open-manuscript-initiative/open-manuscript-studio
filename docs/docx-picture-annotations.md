# Editable graphical text boxes

Insert independent text boxes from **Insert → Text box**, or use **Add text box**
below an image. Select a box to open its independent rich-text editor. Move and
resize it using its handles, arrow keys or numeric coordinates. Text, font
family, point size, RGB color, background, padding, alignment and rotation remain
editable. The image preview scales its annotations together with the bitmap.
The property editor is an independent surface, so manuscript selection and
clipboard handling do not interfere with editing its text.

## Semantic text and presentation

New `OmiTextBox.content` values use the experimental, editor-independent
[text-box content 0.1 profile](https://openmanuscript.org/docs/governance/studio-1.0-architecture/text-box-and-research-provenance-2026-11-13/).
`contentProfile` identifies it; a JSON string holds versioned paragraphs, semantic
runs and bounded presentation values. The Tiptap adapter maps the editor vocabulary
at its boundary. The canonical OMI repository owns both schemas; Studio pins exact
source bytes and generates the profile validator at build time.

Legacy unprofiled text/Tiptap JSON stays readable without an automatic migration.
Unknown profiles or fields stay in the OMI document and history; incomplete views
produce editor and HTML/JATS export warnings. Confirming an explicit edit retains
the original under the namespaced text-box-source extension. Box geometry and other
manuscript content remain editable. This bounded experimental profile does not
freeze the main manuscript ContentCodec. Import preserves literal text without translation.

Images retain an ordered `visual.textBoxes` array. Independent objects use
`visual.kind = "text-box"` and `visual.textBox`. Both survive OMI JSON and asset-
container save/reopen. Schema validation checks geometry; rich-text rendering
admits only the supported semantic vocabulary and safe presentation values.
HTML/PDF publication retains positioned text as HTML inside a responsive SVG
viewport, without rasterizing the labels. The current DOCX/IDML/ODT/EPUB/JATS
adapters retain annotation text with explicit graphical-layout fallbacks; they
do not promise editable Word text-box export.

## DOCX conversion

The shared drawing preparation covers normal, large-document and graphical-
element DOCX import. It selects one `mc:AlternateContent` representation, avoiding
duplicates between DrawingML boxes and their VML fallback. Supported VML-only
boxes are normalized into the same editable model. Only successfully converted
boxes are removed from the main text flow.

Runs retain literal Unicode text, font family, size, direct/theme color and
semantic styles. Typography resolves through document defaults, named styles and
direct overrides. Word half-point sizes convert to CSS pixels using `size * 2 / 3`:
18 half-points means 9 points, or 12 CSS pixels. Unavailable fonts may require a
system substitution. Pictures retain their source crop without recompression.
White masks, insets, paragraph alignment and drawing order remain independent
from the bitmap. Bounds include labels extending outside the visible picture.

Picture-relative placement is exact for supported numeric offsets sharing the
same paragraph anchor. A box anchored in the immediately preceding paragraph can
attach to a unique following inline image. Its vertical position requires an
estimate of the preceding paragraph height; import reports a localized review
warning. Captions, tables and intervening blocks prevent that association.
This is not a Word pagination engine.

Independent or unresolved-picture boxes remain at their semantic paragraph
anchor. Numeric paragraph-relative offsets are retained where possible;
page-relative placement is reported for review. Original page pagination is
not reconstructed. Complex groups, vertical writing, flipped text, fields,
tables or note references inside boxes retain the existing body-text fallback
and warning. Only local raster package parts are embedded; external resources
are not fetched.

## Verification

Fixtures cover all DOCX paths, VML/alternate deduplication, style inheritance,
colors/sizes, white masks, crop, layer order, standalone/rotated boxes, estimated
positions, safe rendering and OMI round trips. Browser checks exercise text
replacement, formatting, geometry, pointer movement and reopening at desktop and
mobile widths. The uploaded manuscript is used for local verification only;
its text and images are not committed.

After updating Studio, reimport the original DOCX to obtain structured boxes.
Earlier flattened imports cannot reconstruct the author's original geometry.
