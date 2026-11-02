# PDF footnotes

The PDF source must place semantic footnote bodies at their first inline anchors
using `float: footnote`. A note list at the end of the HTML document produces
endnotes, even when its `data-note-placement` says `footnotes`.

Both profile-based PDF sources (publication/editorial) and the styled print
source opt into the HTML renderer's `noteLayout: 'paged'`. Explicit note kinds
match the live publication canvas: footnotes float; endnotes remain in the
back matter. Repeated references share one body. Legacy footnotes are resolved
with `getNoteKind`. Notes without an inline anchor remain available in back
matter rather than disappearing. Public annotation filtering still applies.

OMI supplies the reference and body labels, suppressing Vivliostyle's generated
labels so numbering can restart by document scope. The publication style sets
the note font, size, leading and separator. Long notes can continue across pages.
Continuous web HTML keeps its linked notes list.

## Checks

```sh
node --test --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs tests/html-export.test.ts tests/publication-export-formats.test.ts
OMI_RUN_VIVLIOSTYLE_SMOKE=1 npm run test:vivliostyle-pdf
```

The optional smoke test requires the pinned Vivliostyle CLI 11.0.4, Chrome and
Poppler `pdftotext`. It reads bounding boxes from the actual PDF and requires two
footnotes to appear below their anchors near the bottom of two separate pages.

Before accepting a deployment, export a note-heavy manuscript from the live
publication editor in both PDF modes. Check note numbering, a multiline note,
a note continuing onto the next page, genuine endnotes and the saved separator.
Page breaks can differ between the live browser canvas and Vivliostyle; this
fix preserves note placement semantics rather than freezing preview page breaks.
