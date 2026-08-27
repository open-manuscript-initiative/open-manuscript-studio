# Editable publication styles

Publication styles are data, not hard-coded layout rules. A style JSON can therefore be copied and edited without changing the OMI manuscript itself.

## Design principle

The manuscript stores semantic roles (paragraph, heading, abstract, figure caption, footnote, bibliography, etc.). The selected publication style maps those roles to page and typography settings at export time.

## Egyháztörténeti Szemle starter profile

`egyhaztorteneti-szemle.json` is an editable starter reconstructed from the supplied 2026/2 printed PDF sample. Its values are deliberately not treated as authoritative production measurements. The publisher can replace them with the exact InDesign/typesetting values.

Editable groups include:

- page width and height;
- mirrored inner/outer and top/bottom margins;
- body and note fonts;
- font sizes and line heights;
- paragraph indentation and spacing;
- title/subtitle/author/affiliation styles;
- abstracts and keywords;
- heading levels;
- epigraphs;
- footnotes and separator rule;
- figure/table captions;
- bibliography;
- odd/even running headers and page numbering;
- first-page metadata;
- semantic-to-visual mappings.

## Fonts

Do not distribute commercial font files with OMI. The template uses EB Garamond as a freely usable default. A publisher with the appropriate licence may select its locally installed/licensed Garamond family for export.

## Next implementation step

The Studio UI should expose these JSON properties in a Publication Style editor with numeric fields, unit selectors, font selectors, alignment controls and a live page preview. It should support Duplicate, Rename, Import, Export and Reset-to-template operations so journal-specific styles remain portable.
