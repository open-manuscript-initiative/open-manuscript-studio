# Section running headers and page styles

In **Publishing → Publication editor → Page styles and section headers**, create
named page styles from the publication's current print settings. Edit trim size,
inner/outer/top/bottom margins, gutter, mirrored margins, bleed, crop marks and
running headers. Measurements follow the shared mm/pt/pica selector. A change to
a saved style updates its assigned pages; duplicating creates an independent
style. Removing it clears its references while retaining separate section headers.

## Preparing a journal issue

1. Keep each independent study as a top-level section. Select the study under
   **Section settings**, and choose a saved page style if its layout differs.
2. Enable **Use a section-specific running header**. Enter the author or short
   title directly, or use `{{sectionTitle}}`, `{{shortSectionTitle}}`,
   `{{articleTitle}}`, `{{shortArticleTitle}}`, `{{journalTitle}}`,
   `{{volume}}`, `{{issue}}`, `{{year}}` and `{{pageNumber}}`.
3. Configure left/right text separately for odd and even printed pages. Choose
   whether the header appears on the section's opening page, and set its point
   size and rule. Unconfigured subsections inherit their parent's settings.
4. A section with a custom master or header starts a new page. This keeps a
   study's header and layout attached to its semantic section when text moves.
   Resetting the section restores inheritance. A section without custom styling
   can also request an ordinary new-page start.
5. For a physical-page exception, choose a saved style, enter an inclusive
   printed-page range, and select **Apply to pages**. Enter the same number twice
   to format one page. Later assignments win where ranges overlap. Removing an
   exception reveals the underlying section/default settings.

Page exceptions use the publication's **First page number**, excluding covers
and title-matter sheets. They stay at those page numbers after reflow; use section
settings when formatting must follow the text. Publication-wide page numbering
is independent of the numbering stored in an individual master.

## Storage and outputs

The optional `PublicationStyle.pageStyles` collection has `version: 1`, named
`styles`, section-ID `sections`, and inclusive `pages` assignments. Portable
validation bounds geometry, identifiers, ranges, headers and collection sizes.
The complete working format is stored in the document's applied-format extension
and revision history, including documents created without a template. OMI
save/open therefore retains all assignments. Capturing a reusable publication
template copies the named masters, while removing document-specific section IDs
and physical-page exceptions.

The live print view uses variable page heights, margins, inherited section
headers, and page-level overrides. Pagination and measured note continuations
remain presentation-only. As elsewhere in the live editor, the page count is an
estimate: a paragraph that continues across pages with different text widths
retains its starting width in the editable preview. The server-side PDF engine
reflows that paragraph to each page's actual width. Proof mixed-width exceptions
in the generated PDF before printing.

Both publication PDF paths include the same named-page CSS. Vivliostyle's named
page groups suppress the header on each section's first page when requested;
physical `:nth()` selectors apply page exceptions after accounting for enabled
cover and title-matter sheets. Ordinary browser print may not implement these
paged-media selectors; use Studio's server-generated PDF for the final proof.
Responsive HTML keeps its continuous semantic layout and receives no page-style
or section-header rules.
