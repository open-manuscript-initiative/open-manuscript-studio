# Changelog

Notable changes to Open Manuscript Studio are documented in this file.
Application release numbers are independent from the version identifiers of
the portable OMI document model and individual renderers.

## 0.1.0-beta.6 — 2026-09-09

### Account lifecycle and privacy

- Added permanent, user-initiated Studio account deletion with explicit
  confirmation and safeguards for the final institutional or central owner.
- Removed account-scoped sessions, profiles, integration credentials, cloud
  metadata and submission records while retaining shared scholarly history
  only through an anonymized disabled principal.
- Added a responsive account-deletion interface for web, desktop and mobile.

### OJS and OMP launch continuity

- Preserved pending OJS and OMP manuscript launches while users authenticate,
  including password and federated sign-in returns.
- Added localized sign-in guidance and bounded tab-scoped token recovery
  without weakening launch signatures, permissions or server-side expiry.
- Added browser regression coverage for delayed launch consumption and
  automatic manuscript opening after authentication.

### DOCX import fidelity and performance

- Preserved Word content controls in document order and retained text boxes,
  note-only paragraphs, tables, images, notes and inline semantics across the
  standard and monograph import paths.
- Corrected generated-index cleanup while preserving exact index-entry
  locations.
- Reduced large-document memory pressure by caching the DOCX source buffer and
  replacing serialization-based revision cloning with detached structural
  cloning.
- Added complex DOCX integration fixtures and revision-detachment regression
  coverage.

### Compatibility

- No OMI document migration is required. OJS and OMP integration packages
  remain on their independent release lines.

## 0.1.0-beta.5 — 2026-09-08

### Direct publishing integration

- Added direct author submission from Studio to configured OJS and OMP
  installations with stored submission receipts and localized guidance.
- Opened imported OJS articles as standalone studies and preserved first-launch
  manuscripts during session restoration.
- Restored the production `/api` integration prefix and documented the complete
  direct-submission workflow.

### Android and release quality

- Added the native Android package-installer handoff for verified Studio
  updates.
- Aligned Android SDK, signing and release-build configuration and extended
  CodeQL analysis to the Tauri Android Kotlin sources.

### Compatibility

- No OMI document migration is required. OJS and OMP integration packages
  remain on their independent release lines.

## 0.1.0-beta.4 — 2026-09-07

### Updates and navigation

- Added cross-platform update notifications for hosted, desktop and mobile
  Studio clients, including GitHub release fallback when signed updater
  metadata is unavailable.
- Simplified Studio navigation to a one-step menu on desktop and mobile while
  preserving the same-position close control and responsive behavior.

### PDF and print export

- Added independent publication-content and PDF-behavior choices: typeset
  publication or neutral editorial manuscript, combined with print/archive or
  interactive PDF output.
- Preserved clickable internal and external links in interactive PDFs while
  removing active hyperlinks from print/archive output.
- Exposed the same PDF choices in the general Export panel and the publication
  print/export panel with regression coverage.

### Release engineering

- Made published releases immutable in CI: later `main` builds can no longer
  retarget an existing release or replace its downloadable assets.
- Release publication now requires the release tag to resolve to the exact
  build commit; a pre-existing release is never patched or uploaded with
  `--clobber`.
- Hardened current-release promotion so it only promotes a release whose tag
  resolves to the workflow run's exact source commit.

### Compatibility

- No OMI document migration is required. OJS and OMP integration packages are
  released separately on their own version lines.

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
