# Studio UI translation audit

Snapshot: 2026-08-23

This inventory tracks user-visible Studio strings that are not yet fully routed through the 24-locale translation system. The canonical PO audit alone is not sufficient: recent product work introduced component-local EN/HU/DE dictionaries and direct JSX/user-message strings that never entered the PO catalogue.

## Supported UI locales

`bg`, `cs`, `da`, `de`, `el`, `en`, `es`, `et`, `fi`, `fr`, `ga`, `hr`, `hu`, `it`, `lt`, `lv`, `mt`, `nl`, `pl`, `pt`, `ro`, `sk`, `sl`, `sv`.

The legacy `SupportedLocale` type in `src/i18n/types.ts` still says `en | hu | de`. A temporary attempt to widen it to all 24 locales made the TypeScript compiler expose older three-language helper modules. The type must be widened only after those helpers have been migrated; until then it remains tracked translation debt rather than a safe one-line change.

## Canonical PO catalogue status

Each canonical PO catalogue currently contains **722 entries**.

Complete non-English catalogues:

**bg, cs, da, de, es, fr, hu, it, nl, pl, pt**

Explicitly in-progress catalogues:

**el, et, fi, ga, hr, lt, lv, mt, ro, sk, sl, sv**

`en` is the reference locale.

Current catalogue audit details:

- `el`: 721/722 translated (99.9%)
- `et`: 721/722 translated (99.9%)
- `fi`: 722/722 translated, still policy-marked in progress pending review/promotion
- `ga`: 722/722 translated, still policy-marked in progress pending review/promotion
- `hr`: 266/722 (36.8%)
- `lt`: 266/722 (36.8%)
- `lv`: 266/722 (36.8%)
- `mt`: 257/722 (35.6%)
- `ro`: 255/722 (35.3%)
- `sk`: 261/722 (36.1%)
- `sl`: 264/722 (36.6%)
- `sv`: 258/722 (35.7%)

Totals at the initial audit snapshot: **3,685 identical-to-English candidates**, **4,616 reviewed overlay values**, **0 empty translations**, **0 structurally invalid locales**.

This catalogue status covers only strings already inside the canonical catalogue. The source-level migration below additionally covers newer component-local UI copy.

## Source-level audit baseline

`scripts/audit-ui-translations.mjs` is a report-only source scanner run by `npm test`. Its initial baseline reported:

- **89 limited-locale-map candidates**;
- **1,094 raw direct-literal candidates** across **172 files**.

The direct-literal count is intentionally raw. It includes false positives from TypeScript, render templates and export generators. Every candidate must eventually be classified as application UI prose, accessibility text, exported-document language, intentionally unchanged technical content, or scanner false positive.

## Completed migration batches

### Global navigation and menus

- `StudioMenu`: **Assignments** and **Signatures** have explicit values in all 24 locales.
- `Header`: **Search**, **Account**, **Show/Hide document outline**, **Manuscript** and account-overlay **Close** are localized.
- `DesktopDocumentTabs`: open-document navigation and close accessibility labels use shared translations.

### Account, identity and administration — completed for all 24 locales

The following surfaces no longer use visible EN/HU/DE-only dictionaries:

- `src/components/AccountPanel.tsx`
  - page title and subtitle;
  - Personal profile / Institutional profiles / Central administration tabs;
  - personal-profile fields, hints, save/success state;
  - account identity, verified/unverified e-mail state and sign-out.
- `src/components/LinkedIdentitiesSettings.tsx`
  - e-mail/password credential state;
  - connected identity metadata;
  - connect/disconnect controls and confirmations;
  - provider list, refresh/loading/error/status copy.
- `src/components/InstitutionalProfilesSettings.tsx`
  - institution profile list and empty state;
  - create/edit/delete/default actions;
  - organization, ROR, department, role, e-mail and connected-identity fields;
  - MEMBER / ADMIN / OWNER user-facing role labels;
  - confirmation, loading, success and error states.
- `src/components/CentralAdministrationSettings.tsx`
  - institution creation, activation and management;
  - institution administrator management and localized ADMIN / OWNER role labels;
  - scoped Institution Admin API credential controls;
  - token creation/revocation guidance;
  - audit heading and empty state;
  - localized generic fallback errors.

Technical API scope identifiers such as `institution:read` and `members:write` remain intentionally untranslated.

### Storage and cloud — completed for all 24 locales

- `src/components/StudioMenu.tsx` native storage copy is now supplied by `src/i18n/nativeStorageTranslations.ts`:
  - Open / Save / Save As;
  - own-device and shared/foreign-device descriptions;
  - portable/USB open and save flows;
  - OMI portable backup states;
  - Android system file-picker/document-provider copy.
- `src/components/CloudStorageSettings.tsx` now uses `src/i18n/cloudStorageTranslations.ts`:
  - own-device switch and system-storage state;
  - portable storage on shared devices;
  - profile-scoped cloud connections;
  - provider/account type/connection method labels;
  - WebDAV authentication/setup;
  - connect/test/remove actions;
  - cloud backup, restore, delete and confirmations.

A dedicated regression test (`tests/account-storage-localization.test.ts`) requires explicit entries for all 24 supported locales across the migrated Account and storage translation maps. This prevents these surfaces from silently returning to an English fallback for a supported locale.

## Compiler-confirmed three-language core still open

Temporarily widening `SupportedLocale` to all 24 locales previously exposed structurally three-language helpers. The following remain to be migrated or reconciled:

- `src/i18n/authTranslations.ts`
- `src/i18n/crossReferences.ts`
- `src/i18n/cslRendering.ts`
- `src/i18n/exportFormats.ts`
- `src/i18n/help.ts` — special case because supplemental help coverage/tests already exist
- `src/i18n/noteCitations.ts`
- `src/i18n/orcidLookup.ts`
- `src/i18n/referenceLookup.ts`
- `src/i18n/richText.ts`
- `src/i18n/rorAffiliation.ts`
- `src/i18n/sectionStructure.ts`

The final locale-type widening becomes a useful compile-time CI gate only after this set is resolved.

## Priority 0 — remaining global/navigation literals

Still open:

- `src/components/DesktopDocumentOutline.tsx` — local fallback copy;
- `src/mobile/navigation/MobileLayout.tsx` — `Mobile Studio navigation` accessibility label;
- `src/components/SelectionActionToolbar.tsx` — `Selection actions` accessibility label;
- `src/components/LazyBlockEditor.tsx` — deferred-paragraph accessibility label;
- `src/App.tsx` — external manuscript loading/failure text;
- `src/components/Footer.tsx` — tagline, navigation, documentation/license labels and ORCID environment help.

## Priority 1 — authentication and recovery

Next coherent migration unit:

- `src/auth/LoginPage.tsx`
  - personal/institutional-admin mode;
  - provider buttons;
  - federated login errors;
  - product tagline and helper text.
- `src/auth/RegisterPage.tsx`
  - invitation/provider supplemental copy;
  - fixed invitation e-mail hint;
  - product tagline.
- `src/auth/PasswordRecoveryPage.tsx`
  - recovery/reset flow copy;
  - validation/status/error states;
  - product tagline.
- `src/store/authStore.ts`
  - classify and replace directly surfaced English authorization/service errors where a localized error code can be used.

## Priority 2 — ORCID, signature and remaining account-adjacent surfaces

- `src/components/AuthorSignatureControl.tsx`
- `src/components/AuthorSignaturePanel.tsx`
- `src/components/OrcidEnvironmentBadge.tsx`

These still contain EN/HU/DE copy or direct accessibility labels.

## Priority 3 — document-language settings

Storage itself is complete, but the following settings beside it still require migration:

- `src/components/ContentLanguageSettings.tsx`
- `src/components/ManuscriptLanguageField.tsx`
- `src/model/manuscriptLanguage.ts`

## Priority 4 — integrations, proofreading, translation and agents

- `src/components/IntegrationsPanel.tsx`
- `src/components/OjsAssignmentPanel.tsx`
- `src/components/ProofreadingSettings.tsx`
- `src/components/ProofreadingSuggestionCard.tsx`
- `src/components/BlockEditor.tsx` recent integration/proofreading helper text
- `src/editor/useEditorProofreading.ts`
- `src/components/IntegrationExecutionWorkspace.tsx`
- `src/components/SelectionIntegrationDialog.tsx`

This group includes OJS/OMP, DeepL, AI provider configuration, OMI agents, extension registry and integration audit UI.

## Priority 5 — review/editorial workflows

- `src/components/EditorReviewMode.tsx`
- `src/components/ReviewPortal.tsx`
- review recommendation/status helpers must be checked for full locale coverage.

Double-blind terminology needs careful review: translations must preserve the authorization/privacy meaning and must not expose identity through wording differences.

## Priority 6 — editor, metadata and publishing tools

Confirmed candidates include:

- `src/components/SearchReplaceOverlay.tsx`
- `src/components/DesktopUpdatePrompt.tsx`
- `src/components/EditorPane.tsx`
- `src/components/ScholarlyMetadataPanel.tsx`
- `src/components/PublisherExportStylesheetPanel.tsx`
- `src/components/PublisherPrintStylesheetPanel.tsx`
- `src/components/PublisherProfileEditor.tsx`
- insertion/formatting controls;
- notes, citations and references;
- DOCX import;
- history/version controls;
- document/details mobile navigation.

## Translation helpers requiring individual review

The source scan still identifies EN/HU/DE maps or English fallback expressions in helper modules. Some have supplemental overlays, so each needs classification rather than automatic rewriting:

- `assetContainer.ts`
- `cslRendering.ts`
- `exportFormats.ts`
- `frontMatter.ts`
- `htmlExport.ts`
- `jatsExport.ts`
- `noteCitations.ts`
- `orcidLookup.ts`
- `referenceLookup.ts`
- `richText.ts`
- `rorAffiliation.ts`
- `sectionStructure.ts`
- `stateDigest.ts`
- `visualElements.ts`

`help.ts` is pattern-flagged, but dedicated tests already verify substantial help for all 24 locales and no silent English fallback. It must be reconciled with the supplemental help architecture rather than blindly rewritten.

## Exported-document language — separate queue

The source scanner also finds English labels in generated EPUB/HTML/JATS/DTP output, including examples such as `Contents`, `Authors`, `Corresponding author`, `References`, unresolved-reference markers and back-to-note text.

These are not application-menu strings. Generated scholarly output should normally derive human-language labels from manuscript/publication language rather than the Studio interface language.

## Intentionally untranslated technical content

Do not translate standards, identifiers or provider/product names unless surrounding grammar requires it: `OMI`, `ORCID`, `ROR`, `DOI`, `JATS`, `DOCX`, `EPUB`, `IDML`, `XTG`, `MIF`, `SLA`, `LaTeX`, `WebDAV`, `Nextcloud`, `Google`, `Microsoft`, API scopes, URLs, MIME types, token prefixes and file extensions.

## Completion rule

A surface is complete only when:

1. user-visible text is routed through shared i18n or an explicit 24-locale map;
2. all 24 locales have explicit reviewed values or documented intentional-identical entries;
3. buttons, menus, tooltips, placeholders, `aria-label`s, confirmations, empty states, errors and success messages are included;
4. dynamic templates do not concatenate untranslated English fragments;
5. no new EN/HU/DE-only helper is introduced;
6. output-document labels are classified separately from application UI strings.

## Work sequence

1. remaining global navigation/accessibility literals;
2. login/register/password recovery;
3. ORCID/signature surfaces;
4. content/manuscript-language settings;
5. OJS/OMP, proofreading, DeepL and agents;
6. review/editorial surfaces;
7. remaining editor/metadata/publishing literals;
8. output-document label localization by manuscript/publication language;
9. widen `SupportedLocale` safely to all 24 languages and make incomplete maps compile-time errors;
10. make the source audit a strict no-new-untranslated-UI CI gate.

## Progress

- [x] canonical 24-locale list identified;
- [x] current PO completion/in-progress status recorded;
- [x] source-level report-only audit added to tests;
- [x] compile-time three-language core identified;
- [x] Assignments and Signatures translated in all 24 locales;
- [x] global Header and desktop-tab batch localized;
- [x] Account shell localized in all 24 locales;
- [x] Connected identities localized in all 24 locales;
- [x] Institutional profiles localized in all 24 locales;
- [x] Central administration localized in all 24 locales;
- [x] native Open/Save/Save As/portable-storage labels localized in all 24 locales;
- [x] Android native storage/document-provider copy localized in all 24 locales;
- [x] Storage and cloud connections localized in all 24 locales;
- [x] regression test added for Account/storage locale completeness;
- [ ] remaining global/accessibility literals migrated;
- [ ] authentication/recovery migrated;
- [ ] ORCID/signature surfaces migrated;
- [ ] content/manuscript-language settings migrated;
- [ ] integrations/review/editor candidates classified and migrated;
- [ ] output-language labels localized;
- [ ] `SupportedLocale` widened safely to all 24 locales;
- [ ] strict CI untranslated-UI gate enabled.
