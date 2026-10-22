# External object source attribution in Studio

## Application rule

An object created outside the current OMI manuscript needs an appropriate source
when it is inserted as scholarly material. The source rule belongs to the
application intake workflow. It does not retroactively invalidate an existing
OMI manuscript.

A user may declare imported DOCX/PDF content to be their own work from another
editor and omit a visible source line. Studio does not attach a hidden
`omi:source-origin` annotation to the first manuscript block: that block may be
an opening heading, and source metadata must not prevent its editing or
deletion. The explicit own-work choice is retained as document metadata under
`extensions["https://openmanuscript.org/extensions/manuscript-import-origin/1"]`:
`version: 1`, `sourceFormat` (DOCX/ODT/PDF in lowercase), `importedAt`, and
`assertion: "author-declared:self-authored-outside-omi"`. No filename, URL,
account identity or content identifier is stored. This is historical self-attestation,
not verified authorship of the imported work or subsequent edits. The existing
OMI extension mechanism preserves it in working files, core snapshots and history.
Public publication projections strip it; anonymous server review uses its existing
allowlist and excludes it. All document parts can be edited, replaced, moved or
deleted independently. For third-party material, Studio asks
for a reviewed source and adds the source line only after confirmation; a file
name or URL can be a source hint, and users can correct it before import.

## Editable intake path matrix

| Intake path | Source and authority rule | Own-work declaration | Regression coverage |
| --- | --- | --- | --- |
| File or clipboard → visual object (image, table, chart, equation, score) | Each third-party object needs a reviewed visible source. File name, worksheet, chart, or archive part may prefill it; the user can edit it. Confirmed source links to a provisional bibliography record with `prov:wasDerivedFrom`. | Eligible per object, including mixed batches. The private local filename is stripped from own-work visual provenance. | `tests/visual-blocks.test.ts`; source review and missing-source checks in visual import tests. |
| DOCX/ODT → whole manuscript | Third-party import asks for a reviewed visible source line. The file name may prefill the field; the author can correct it. | The author can choose own work and omit the source line; no hidden marker is attached to a heading or other text block. Import history remains in version metadata. | `tests/docx-manuscript-fidelity.test.ts`, `tests/omi-file-format.test.ts`, `tests/versioning-model.test.ts`. |
| PDF → whole manuscript | Same source-review flow as DOCX. | The author can choose own work and omit both the visible source line and a hidden block marker. Import history remains in version metadata. | PDF import and source tests, `tests/omi-file-format.test.ts`, `tests/versioning-model.test.ts`. |
| OJS / OMP submission intake | Publisher platform, submission title, and assigned review document remain authoritative. Provider source notice is retained; reviewer identity and private package names are not exposed. | Not eligible: this path imports an externally managed submission, not an author attestation about a file from another editor. | OJS/OMP intake and anonymous review tests. |
| RIS / BibTeX / CSL → bibliography | Imports bibliographic records only. Confirm the parsed records; source attribution stays in the bibliography model. | Not eligible: no manuscript object is created. | Bibliography import preview and confirmation tests. |
| Research module → saved excerpt | Use the module's source and allowed named-field projection. User reviews the excerpt and source before insertion. | Not eligible: the excerpt is attributed to its research record. | Module source-required excerpt tests. |
| OMI JSON/container, study, or editorial snapshot → open | Validate and preserve its existing semantic provenance and revision history. Do not synthesize a new origin declaration. | Not eligible: the imported OMI file already declares its own provenance state. | `tests/omi-file-format.test.ts` and portable conformance fixtures. |
| IDML → publication styles | Imports styling data only; it does not create manuscript content. | Not eligible. | IDML import tests. |
| Native editor text paste or drop into an existing text block | This is an edit to an existing range, not a standalone intake object. The current origin annotation targets a whole block and cannot truthfully identify arbitrary pasted ranges. | Not supported by the block-level declaration. Range-level provenance would need a separate model and review flow. | Editor undo tests cover text edits; they do not assert source-origin provenance for pasted ranges. |
| Asset/media attachment without insertion into a manuscript | Attachment alone does not create a scholarly manuscript object or source attribution. | Not eligible until an attachment path inserts an attributed manuscript object. | Asset/media caller inventory is recorded with issue #633. |

## Export and reviewer privacy

Public HTML, PDF print HTML, JATS, DOCX, and EPUB use the public manuscript
projection. Hidden semantic annotations and their rich-text anchors are omitted.
Anonymous reviewer snapshots are an allowlisted article projection; source
annotations, local filenames, and author identity do not enter that projection.
PDF uses the same publication HTML projection before printing.

Studio has JATS export, but there is no standalone JATS manuscript importer in
the current tree. JATS import is therefore outside the supported intake matrix
and must not be reported as complete.

## Regression matrix

| Concern | Expected behavior | Verification |
| --- | --- | --- |
| Missing third-party source | Reject third-party intake until a nonempty reviewed source is supplied; own-work imports can continue without a source line or text-anchored marker. | Existing visual, DOCX, and PDF import tests. |
| Automatic source prefill and correction | Prefill with available metadata, then use the user's reviewed value. Prefill is a hint, not an immutable citation. | Existing visual source-prefill and source-review tests. |
| Local path and URL privacy | Do not place an own-work local filename, local path, or source URL in the origin annotation, public exports, or anonymous reviewer projection. A reviewed third-party source URL remains part of that public source. | `tests/docx-manuscript-fidelity.test.ts`, `tests/visual-blocks.test.ts`, `tests/publication-export-formats.test.ts`, `tests/peer-review-model.test.ts`. |
| Anonymous review | Reviewer projection contains manuscript content and bibliography only; it omits author identity, source-origin annotations, source links, and private filenames. | `tests/peer-review-model.test.ts`. |
| Undo, heading deletion and revision revert | Imported headings can be edited or deleted because whole-document source origin is not anchored to the first block. Reverting a revision restores the imported document state. | `tests/docx-manuscript-fidelity.test.ts`, `tests/continuous-manuscript-document.test.ts`, `tests/versioning-model.test.ts`. |
| Lossless OMI round-trip | Keep annotation target, predicate text, declaration body, and timestamps through save/reopen/resave. | `tests/omi-file-format.test.ts`. |
| Public output filtering | Omit the exact origin declaration and marker from public HTML, PDF, DOCX, JATS, and other publication formats without mutating portable state. | `tests/publication-export-formats.test.ts`. |

The semantic relation between third-party imported visual objects and
bibliographic records is already defined by OMI-SPEC-225 and implemented in
Studio. Keep this separate from visible citation occurrences and technical
import provenance.
