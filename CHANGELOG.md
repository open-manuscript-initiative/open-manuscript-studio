# Changelog

Notable changes to Open Manuscript Studio are documented in this file.
Application release numbers are independent from the version identifiers of
the portable OMI document model and individual renderers.

## 0.1.0-beta.3 — 2026-09-05

### PKP workflow integration

- Added disposable, native OJS and OMP 3.5 workflow environments covering
  editor, author and double-anonymous reviewer launches.
- Verified assignment-scoped reviewer files, required native review forms,
  typesetting corrections, author-visible and editor-only feedback, and
  signed Studio-to-PKP writeback.
- Restricted OMP reviewer projections to the assigned study and excluded
  parent-monograph, sibling-study and contributor identity data.

### Documents and interface

- Added direct creation flows for OMI studies and monograph or edited-volume
  documents with editable title-page metadata.
- Improved the responsive login, menu, editor and footer layout across phone,
  desktop and packaged application views.
- Added Wiki links and updated specification-facing navigation.

### Compatibility

- No OMI document migration is required. OJS and OMP integration packages are
  released separately on their own version lines.

## 0.1.0-beta.2 — 2026-09-03

### Editing and navigation

- Added a full-screen live publication editor with a compact, Word-like top
  ribbon and dropdown panels on desktop and mobile.
- Kept long manuscripts visually continuous while retaining structured OMI
  sections, stable block identities and semantic editing in the background.
- Improved document navigation, paragraph splitting and current-study note
  handling without flattening scholarly structure.

### Publication design

- Added configurable print pages, mirrored margins, gutters, bleed, crop
  marks, running headers and page-number starts.
- Added language-aware, optional print hyphenation with lazy-loaded language
  modules and per-paragraph language support.
- Added InDesign-like paragraph styles with “Based on” inheritance, “Next
  style”, reusable definitions and portable block assignments.
- Replaced manually typed font-family fields with dropdowns and added
  permission-gated discovery of installed system fonts. Available Light,
  Medium, Semibold, Bold, Black and italic faces now appear as an
  InDesign-like font-style list, with searchable live type samples and a
  portable fallback catalog.
- Changed live pagination so ordinary paragraphs continue line by line onto
  the next page. Explicit keep rules and heading widow/orphan behaviour remain
  available where required.
- Preserved paragraph-style assignments in semantic HTML and print exports.

### Proofreading and peer review

- Added Word-like tracked changes, exact insertion/deletion comparisons,
  accept/reject controls, scoped comments and persisted review state.
- Added color-coded, icon-labelled proofing highlights for insertions,
  deletions, replacements and comments in the editor and peer-review view.
- Added visual typesetting corrections for optional hyphens, nonbreaking
  ranges, forced line breaks, page breaks and paragraph keep rules, each with
  its own color and legend.
- Restricted OJS review workspaces to an anonymous article view and OMP review
  workspaces to the assigned study instead of the parent monograph.
- Kept author and reviewer account identity out of double-blind projections.

### Compatibility

- No OMI document migration is required for this application release. The
  portable manuscript schema and renderer compatibility identifiers remain on
  their existing independently versioned lines.
