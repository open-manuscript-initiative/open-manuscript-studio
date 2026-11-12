# Word picture annotations

DOCX import preserves floating text boxes over raster pictures as a single,
self-contained SVG image. The bitmap remains embedded without recompression.
The annotation text remains text inside the SVG and scales with the picture.
It is part of the artwork, not an independently editable manuscript paragraph.

The shared drawing preparation runs in the normal and monograph import paths.
It selects one Word `mc:AlternateContent` drawing representation so modern
DrawingML text boxes and legacy VML copies cannot duplicate the same label.
Only labels successfully incorporated into the artwork are removed from the
main text flow. Other text boxes retain the existing editable-text fallback.

## Typography and positioning

Each text run retains its literal text, font family, size, RGB or theme color,
bold/italic setting, and superscript/subscript alignment. Font sizes resolve
through document defaults, named style inheritance and direct overrides.
Word half-point sizes convert to CSS pixels with `size * 2 / 3`; for example,
18 half-points means 9 points, or 12 CSS pixels. Missing system fonts can still
require a renderer font substitution.

The picture retains its Word source crop before annotations are overlaid.
The artwork includes the text-box background, insets, paragraph alignment,
wrapping and drawing layer order. Its bounds include labels extending outside
the bitmap so annotation text is not clipped at the picture edge. Images and
labels resize together in the editor and the existing HTML/PDF image pipeline.

Picture-relative placement is exact for supported numeric offsets sharing the
same paragraph anchor. An annotation anchored in the immediately preceding
paragraph can be attached to a unique following inline picture. The vertical
position then requires an estimate of the preceding paragraph's rendered height;
import shows a localized review warning. This is not a Word pagination engine.
A caption, table or other intervening block prevents that association.

Page-relative vertical positioning, rotated text boxes, tables, fields, note
references, and unresolved picture relationships keep the text fallback rather
than silently discarding unsupported content. Arbitrary groups, VML-only layout
and complex drawing transformations are outside the supported picture-overlay
path. Raster inputs are embedded only from local DOCX package parts; no external
images or external SVG resources are fetched.

## Validation

Synthetic fixtures exercise both parsers: per-run colors and sizes, font style
inheritance, white masks, layer order, alternate-content deduplication, Unicode
and escaping, preceding-paragraph estimates, safe fallback, and labels extending
below an image. The uploaded manuscript is used only for local verification;
its text and images are not committed to the repository.
