# Changelog

Notable changes to Open Manuscript Studio are documented in this file.
Application release numbers are independent from the version identifiers of
the portable OMI document model and individual renderers.

## Unreleased

### OJS/OMP publication artifact transfer

- Replaces the Publication panel's legacy HTML-only OJS transfer client with the
  `omi-publication-artifact/1` client introduced by OJS Integration 1.5.0.0.
- Discovers destination-supported publication formats and size limits before
  transfer instead of assuming HTML availability.
- Builds and transfers provenance-bound self-contained HTML, validated JATS XML,
  print PDF and interactive PDF artifacts.
- Sends the exact `omi-publication-build@0.1.0` manifest with the artifact so
  OJS can independently verify byte length, SHA-256, renderer metadata and the
  deterministic build identifier before persistence.
- Keeps the personal OJS editorial API key server-side and forwards it only as
  native Bearer authorization to the fixed trusted plugin endpoint.
- Removes the obsolete HTML-only transfer endpoint and compatibility facade; the
  Publication UI and server now use only the shared multi-format protocol.
- Blocks direct JATS transfer when the XML depends on package-local binary media
  that the single-artifact protocol cannot carry.
- Extends the same protocol to OMP Integration 1.4.0.0 while preserving native
  OMP Publication Format and proof-file semantics instead of emulating OJS
  galleys.
- Stores a separate personal OMP editor API key in the identity/profile
  database and keeps OJS/OMP credentials isolated at the server proxy.
- Requires OMP to advertise unapproved/unavailable/non-viewable authority
  defaults before the client enables transfer.
- Supports OMP studies with HTML/JATS/PDF and OMP volumes with print or
  interactive PDF; article-only HTML/JATS renderers are not reused for a whole
  volume.


## 0.2.0-beta.1 — 2026-09-18

### Validated publication pipeline

- Adds full offline **NISO JATS 1.4 Article Authoring / MathML 3 DTD**
  validation with a pinned local schema package and hardened XML trust boundary.
- Adds a machine-readable OMI → JATS conformance matrix and publication release
  gates so known semantic-fidelity fallbacks block release even when the XML is
  technically DTD-valid.
- Adds an offline **JATS4R** publication profile for the Article Authoring
  surface emitted by Studio, with release-blocking errors and advisory
  warnings.
- Adds deterministic JATS, semantic HTML and PDF publication-build provenance
  through portable `.omi-build.json` sidecars containing committed revision,
  state/profile digests, exact artifact SHA-256 and renderer identity.

### PDF and HTML artifacts

- Replaces the standard browser print-dialog PDF path with pinned
  **Vivliostyle CLI 11.0.4** server-side artifact generation.
- Keeps print/archive and interactive PDF behavior separate while rendering
  both through the same controlled paged-media pipeline.
- Fingerprints the exact self-contained HTML supplied to Vivliostyle for PDF
  provenance.
- Makes semantic HTML ZIP output reproducible by deriving package timestamps
  from the committed manuscript revision.

### Scholarly publishing metadata

- Adds the publication-venue registry and reusable publication-venue metadata
  workflow for integrated scholarly publishing destinations.
- Improves JATS contributor, affiliation, ORCID/ROR, permissions, licence and
  accessibility-oriented output required by the new validation profiles.
- Keeps private review/editorial annotations outside publication-facing JATS
  note output.

### Release quality and platform hardening

- Extends the 1.0 readiness evidence with JATS validation, JATS4R profile
  checks, publication release gates and a real Vivliostyle PDF smoke render.
- Strengthens Android release preparation, modern UI configuration and version
  code handling.
- Advances the shared application version to **0.2.0-beta.1**.
- Reserves Android versionCode **1030**, advances the Windows MSI product
  version to **0.2.0.1**, and advances the iOS marketing/build identity to
  **0.2.0 / 9**.

### Compatibility

- No OMI manuscript migration is required by this application release.
- OJS and OMP integration packages remain independently versioned.
- JATS4R validation is intentionally scoped to Studio's current Article
  Authoring output and does not claim to replace the complete official JATS4R
  Schematron validator.

## 0.1.1-beta.1 — 2026-09-15

### Google Play and Android release

- Advances the visible Studio version to **0.1.1-beta.1** after
  Google Play **0.1.0-beta.10**.
- Reserves Android versionCode **1025**, above the previously uploaded
  versionCode **1024**.
- Keeps the Android version name and build number consistent across the
  npm, Cargo and Tauri release metadata.

## 0.1.0-beta.9 — 2026-09-12

### Google Play and Android compatibility

- Includes the Play-specific update channel: Play builds open Google Play for
  updates and omit the APK installation permission; direct APK builds retain
  the verified native updater.
- Includes 16 KB link alignment for the arm64-v8a and x86_64 Studio libraries.
- Android Release verifies the actual AAB permissions, versionCode, 64-bit ELF
  alignment and 16 KB packaging before Play upload.
- Advances Android versionCode from 1010 to **1011**, above previously uploaded
  versionCode 1009. The displayed version is **0.1.0-beta.9**.
- Synchronizes npm, Cargo and Tauri versions, Windows MSI version 0.1.0.11,
  and iOS build number 8.
- The Android release must pass its artifact checks and device testing before
  rollout. Android edge-to-edge warnings remain a separate follow-up.

## 0.1.0-beta.7 — 2026-09-12

### Author signatures

- Fixed verified ORCID identity lookup to use the Identity database, matching
  the ORCID sign-in and linking flow.
- The owner confirmed the complete ORCID, passkey registration and manuscript
  revision signing flow on Android Chrome. This is a web-client acceptance
  check; the new packaged Android build still requires its own smoke test.

### Packaging

- Aligned application and installer versions for this beta.
- Set Android versionCode to 1007 so beta builds can advance beyond the
  semver-derived 1000 used by version 0.1.0. Confirm the highest code in Play
  Console before uploading if any build has been numbered manually.
- The ORCID correction requires an updated Studio API; client installation
  alone does not update a self-hosted server.

### Android authentication

- Added the Google Play App Signing certificate to the verified Android App
  Link association alongside the direct-release certificate.
- Replaced the browser-specific Android ORCID fallback intent with the
  registered `openmanuscript://auth` scheme, improving the return to Studio on
  Redmi/Chrome devices.

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
