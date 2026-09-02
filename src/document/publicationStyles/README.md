# Editable publication styles

Publication styles are data, not hard-coded layout rules. A style JSON can therefore be copied and edited without changing the OMI manuscript itself.

## Design principle

The manuscript stores semantic roles (paragraph, heading, abstract, figure caption, footnote, bibliography, etc.). The selected publication style maps those roles to page and typography settings at export time.

A complete publication setup can consist of two portable layers:

1. a **publication style** for typography, page geometry, notes, captions and running heads;
2. a **publisher identity profile** for journal branding, logo, publisher metadata, ISSN/eISSN, issue metadata, DOI presentation, copyright and licence information.

Keeping these layers separate allows one typographic style to be reused with different branding and allows branding/legal data to change without modifying the manuscript or typography.

## Egyháztörténeti Szemle starter profile

`egyhaztorteneti-szemle.json` is an editable starter reconstructed from the supplied 2026/2 printed PDF sample. Its values are deliberately not treated as authoritative production measurements. The publisher can replace them with the exact InDesign/typesetting values.

`egyhaztorteneti-szemle.publisher.json` is the editable publisher identity companion. It contains only values supported by the current project context. Unknown authoritative values are intentionally left empty rather than guessed.

Editable publisher fields include:

- full and short journal title;
- publisher name and address;
- journal website and contact address;
- ISSN and eISSN;
- logo source, alternative text, maximum size and PDF/HTML visibility;
- volume, issue and publication year;
- issue display template;
- DOI display rules;
- copyright holder and © template;
- licence label, URL and optional licence icon;
- first-page versus HTML branding/legal display switches.

The default copyright template is `© {{year}} {{copyrightHolder}}`. Template values are resolved at export time.

### Adding the real journal logo

Set `branding.logo.src` in the publisher JSON (or its locally saved Studio value) to a supported public/OMI asset path or data URL. The file itself should be a journal-owned or otherwise properly licensed asset. OMI does not bundle an invented substitute logo.

### HTML and PDF behavior

PDF/print output may show the journal logo on the article first page, the legal/copyright block and the existing running-head/page geometry rules. HTML output uses the same journal identity and typography but remains continuous: it has no running header, page number, page size or forced pagination. Its branding is article-level rather than page-level.

Editable typography groups include:

- page width and height;
- mirrored inner/outer and top/bottom margins;
- binding gutter, print bleed, crop marks and starting page number;
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

## Live publication editor

The Publication menu renders the complete current manuscript inside the selected publication style instead of showing placeholder preview text. The surface remains a normal rich-text editor: changing a paragraph into a heading, quotation or list updates the structured OMI manuscript immediately, while page and typography changes update the active export style without rewriting manuscript semantics.

The on-screen page width, trim ratio, margins, gutter, bleed, crop marks, running headers, type sizes, leading and paragraph indentation are read from the same style object used by the HTML/print export renderer. Page guides are an editing aid; the final PDF page fragmentation remains the responsibility of the print renderer and its CSS Paged Media rules.

## Fonts

Do not distribute commercial font files with OMI. The template uses EB Garamond as a freely usable default. A publisher with the appropriate licence may select its locally installed/licensed Garamond family for export.

## Portability

Both JSON files are intentionally human-editable and portable. A later Studio Publisher Profile editor can expose these fields with text inputs, asset pickers, switches and live preview without changing the underlying file format.
