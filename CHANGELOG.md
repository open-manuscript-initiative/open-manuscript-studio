# Changelog

Notable changes to Open Manuscript Studio are documented in this file.
Application release numbers are independent from the version identifiers of
the portable OMI document model and individual renderers.

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
