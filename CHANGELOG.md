# Changelog

Notable changes to Open Manuscript Studio are documented in this file.
Application release numbers are independent from the version identifiers of
the portable OMI document model and individual renderers.

## Unreleased

## 0.2.0-beta.4 — 2026-09-21

### Cross-platform catch-up and mobile stabilization

- Adds one shared cross-platform interface-language registry covering all 49
  Google Play locale entries. Regional English, Spanish, French and Portuguese
  store locales map to canonical Studio UI locales; Chinese variants remain
  distinct. The existing Irish and Maltese locales are retained, yielding 47
  selectable UI locales across web, desktop and mobile builds. Newly exposed
  locales without reviewed PO catalogues currently use the English reference
  fallback.

- Keeps the persistent mobile Studio header visible above the full-width Account
  workspace and removes the duplicate Account-local logout action; logout
  remains available only in the persistent top header.

- Makes the Account workspace use the full mobile viewport width, removing the
  side gutter/backdrop and constraining account cards and profile content to
  the phone width without horizontal overflow. The duplicate in-panel mobile
  close button is removed; the persistent top Account control becomes the only
  mobile close control while Account is open.

- Isolates the full-screen mobile manuscript navigation from the currently
  mounted workspace so sticky toolbars, popovers, and editor controls cannot
  bleed through the menu. External workspaces such as Lists, OMI Agents,
  Integrations, and Help now also open correctly as the first menu selection.

- Replaces the horizontally scrolling manuscript navigation on phone-sized views
  with a full-window grid. Horizontal scrolling is prevented; vertical scrolling
  remains available when the menu items exceed the available height. Selecting
  a workspace dismisses the navigation and reveals that workspace.

- Keeps interface language and logout controls in the persistent top header row,
  alongside menu, OMI Home, and personal account. Opening the manuscript menu
  from the editor now shows navigation only and does not implicitly activate
  Document; closing it returns to the unchanged editor workspace.

- Reorganizes the Studio header into two persistent rows: manuscript menu, OMI
  Home brand, and personal account stay in the top row at every responsive
  width, while editing, search, insert, save, language, and logout controls
  remain in the secondary row. Native mobile moves Account from bottom
  navigation to the permanent top row as well.

- Makes the OMI/Studio brand in the desktop and mobile header a keyboard-accessible
  Home control, matching the explicit Home action in manuscript navigation.

- Allows a personal profile to store separate encrypted OJS and OMP API keys
  for multiple publishing installations. Credentials are selected by provider
  and exact normalized installation URL; existing single OJS/OMP keys migrate
  automatically into the new collection.

- Keeps the current Studio workspace active when the manuscript navigation is
  opened and closed. Returning to the editor is now an explicit localized Home
  menu action instead of an automatic side effect of closing navigation.

- Collapses manuscript-menu navigation after choosing any workspace, including
  Help, Lists and Integrations. A header toggle reopens it without losing the
  current view; desktop and mobile content reclaim the navigation space.

- Shows the document selection toolbar after completed text selections,
  including delayed native touch selection and selection-handle changes.
  Scrolling repositions the menu instead of dismissing it; Escape, outside
  clicks and collapsed selections still dismiss it, while toolbar fields keep
  their focus and selection.

- Keeps live-publication page boundaries visible across the full sheet width,
  including while editing on mobile, with clearer outlines and wider page gaps.
  The mobile print-layout status and zoom controls wrap within the viewport.

- Places live-publication footnotes at the bottom of the sheet containing their
  reference, reserving space during pagination and preserving manuscript note
  numbering. Long notes continue on subsequent sheets; endnotes remain at the
  end. Layout recalculates after edits, zoom changes and font loading.

- Adds direct WordPress and generic website/newsletter publishing from the
  semantic HTML5 publication path. Personal credentials remain encrypted
  server-side; WordPress uses application passwords, preview/approval precedes
  external writes, and repeated sends update the same external post.

- Removes the obsolete native-mobile bottom navigation bar now that manuscript
  navigation and Account access live in the persistent top/menu surfaces. The
  editor reclaims the released viewport area and respects the device safe-area
  inset at the bottom.

- Adds a Word-style zoom control to normal manuscript editing: 50–200%,
  minus/slider/percentage/plus controls, one-click 100% reset, a compact mobile
  magnifier trigger, and device-local persistence without changing OMI
  manuscript data.

### Release metadata

- Advances the shared Studio version to **0.2.0-beta.4**.
- Advances the Windows MSI product version to **0.2.0.4**.
- Keeps the iOS marketing version at **0.2.0** and advances the experimental
  iOS build number to **12**.
- Raises the checked-in Android versionCode floor to **1100** and reserves
  beta.4 workflow-generated release codes above that floor.
- No OMI manuscript-format migration is required by this application release.

## 0.2.0-beta.3 — 2026-09-20

### Final stabilization beta

- Establishes this release as the final planned beta before the 1.0 release
  candidate, with Route A feature scope frozen around the already implemented
  authoring, review, publishing, identity and native-client capabilities.
- Removes the manuscript title from the application header so long titles no
  longer compress or collide with the Studio brand and global controls.
- Adds explicit central OMI-account, institutional OIDC and local Studio
  sign-in paths while keeping document and role authorization local to each
  Studio installation.

### OMI lifecycle and publication fidelity

- Adds a canonical all-features reference manuscript covering the portable OMI
  model and a real browser lifecycle gate for open/import, edit, save, close,
  reopen and export.
- Distinguishes portable-model completeness from publication-format fidelity:
  the all-features corpus must be blocked by the JATS publication release gate
  when fallback-only semantics would otherwise be silently reduced.
- Adds deterministic readiness evidence around the reference-manuscript
  lifecycle and existing publication release gates.

### OJS Stable acceptance

- Promotes the tested OJS integration baseline to a release-blocking Stable
  acceptance matrix for OJS 3.5.0-4 and 3.5.0-5.
- Verifies signed editor/author/reviewer launches, replay protection,
  double-anonymous reviewer projection, assignment-scoped file access,
  required native review forms, native recommendation persistence and
  separation of author-visible versus editor-only review feedback.
- Keeps OMP 3.5.x explicitly Preview; shared test infrastructure does not
  silently promote OMP to the OJS Stable support tier.

### Security, accessibility, recovery and distribution

- Adds a release-hardening gate for portable credential exclusion, identity and
  integration trust boundaries, native-auth return allowlisting and updater
  integrity.
- Adds desktop and mobile browser accessibility regression checks for labelled
  controls, accessible dialogs, image alternatives, duplicate IDs, tabindex
  policy and keyboard operation.
- Adds a real browser crash/session recovery round trip backed by IndexedDB.
- Adds Windows MSI install/uninstall, Linux DEB install/uninstall plus AppImage
  extraction, and Android APK package/signature checks to the native build
  matrix.
- Physical Android install → update → uninstall acceptance completed
  successfully on the recorded Redmi Note 13 Pro+ 5G reference device.

### Release metadata

- Advances the shared Studio version to **0.2.0-beta.3**.
- Advances the Windows MSI product version to **0.2.0.3**.
- Keeps the iOS marketing version at **0.2.0** and advances the experimental
  iOS build number to **11**.
- Raises the checked-in Android versionCode floor to **1050**, matching the
  latest Google Play upload for **0.2.0-beta.2**; the beta.3 Play build must use
  a strictly higher run-derived versionCode.
- No OMI manuscript-format migration is required by this application release.

## 0.2.0-beta.2 — 2026-09-19

### OJS/OMP publication workflow

- Replaces the legacy HTML-only publication transfer with the shared
  `omi-publication-artifact/1` protocol for provenance-bound HTML, validated
  JATS XML, print PDF and interactive PDF artifacts.
- Discovers destination-supported formats and size limits before transfer and
  keeps personal OJS/OMP editorial credentials server-side.
- Preserves native OJS galley and OMP Publication Format/proof semantics instead
  of flattening both systems into one generic upload model.
- Adds the native OMP Studio client for capability discovery, author revision
  upload, assignment-scoped reviewer attachments, review-form responses and
  `review-result-v2` writeback while keeping OMP authoritative for workflow
  completion and editorial decisions.
- Keeps OJS and OMP reviewer/author access bound to the concrete submission,
  assignment, review round and allowed file stages, with regression coverage for
  double-role accounts and cross-assignment/cross-round access.

### Reference management and scholarly metadata

- Adds a reference-manager integration layer with RIS, BibTeX and CSL JSON
  interchange, bulk import, deduplication and linked-record refresh support.
- Adds Mendeley OAuth integration with allowlisted callback handling and
  server-side redirect validation.
- Expands PKP-compatible contributor and submission metadata used by OJS/OMP,
  including structured contributor identity, affiliations, ORCID-compatible
  fields and conflict-of-interest metadata.
- Preserves given and family names separately so publication typography can
  format author names without losing contributor identity structure.

### Editing and interface

- Removes developer-facing implementation wording and placeholder/example text
  from end-user publication forms.
- Fixes paragraph-type changes that could move the selection to the end of the
  document and preserves the active paragraph after block-type changes.
- Removes the duplicate extended-metadata panel and keeps the publication
  metadata surface aligned with the PKP integration model.

### Security, compatibility and testing

- Adds OMP 3.5 native integration contract tests and full PKP E2E coverage for
  capability discovery, reviewer/author role boundaries and server-side
  writeback.
- Hardens OAuth callback redirects and native PKP workflow identifiers instead
  of trusting browser-supplied remote destinations or file associations.
- Keeps OMP 3.5.0-4 compatibility through feature detection where later PKP
  application APIs are unavailable.
- No OMI manuscript migration is required by this application release.

### Release metadata

- Advances the shared Studio version to **0.2.0-beta.2**.
- Reserves Android versionCode **1031**.
- Advances the Windows MSI product version to **0.2.0.2**.
- Keeps the iOS marketing version at **0.2.0** and advances the iOS build number
  to **10**.

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
