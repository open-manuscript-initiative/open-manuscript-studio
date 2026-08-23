# Studio UI translation audit

Snapshot: 2026-08-23

This inventory tracks user-visible Studio strings that are not yet fully routed through the 24-locale translation system. The canonical PO audit alone is not sufficient: recent product work introduced component-local EN/HU/DE dictionaries and direct JSX/user-message strings that never entered the PO catalogue.

## Supported UI locales

`bg`, `cs`, `da`, `de`, `el`, `en`, `es`, `et`, `fi`, `fr`, `ga`, `hr`, `hu`, `it`, `lt`, `lv`, `mt`, `nl`, `pl`, `pt`, `ro`, `sk`, `sl`, `sv`.

The legacy `SupportedLocale` type in `src/i18n/types.ts` still says `en | hu | de`. A temporary attempt to widen it to all 24 locales made the TypeScript compiler expose the older three-language helper modules listed below. The type must be widened only after those modules have been migrated; until then it is itself tracked translation debt rather than a safe one-line change.

## Canonical PO catalogue status

Each canonical PO catalogue currently contains **722 entries**.

Complete non-English catalogues:

**bg, cs, da, de, es, fr, hu, it, nl, pl, pt**

Explicitly in-progress catalogues:

**el, et, fi, ga, hr, lt, lv, mt, ro, sk, sl, sv**

`en` is the reference locale.

Current audit details:

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

Totals: **3,685 identical-to-English candidates**, **4,616 reviewed overlay values**, **0 empty translations**, **0 structurally invalid locales**.

This status covers only strings already inside the canonical catalogue.

## Source-level audit baseline

`scripts/audit-ui-translations.mjs` is a report-only source scanner run by `npm test`. Its first baseline reports:

- **89 limited-locale-map candidates**;
- **1,094 raw direct-literal candidates** across **172 files**.

The direct-literal count is intentionally raw. It includes false positives from TypeScript, render templates and export generators. Every candidate must be classified as:

1. application UI prose;
2. accessibility text;
3. exported-document language;
4. technical/standards content intentionally unchanged;
5. scanner false positive.

The limited-locale-map findings are stronger evidence and are migrated first.

## Compiler-confirmed three-language core

Temporarily widening `SupportedLocale` to all 24 locales caused the build to fail on these older helpers, proving that they are structurally typed as three-language dictionaries:

- `src/i18n/authTranslations.ts`
- `src/i18n/crossReferences.ts`
- `src/i18n/cslRendering.ts`
- `src/i18n/exportFormats.ts`
- `src/i18n/help.ts` — requires special handling because supplemental help coverage/tests already exist
- `src/i18n/noteCitations.ts`
- `src/i18n/orcidLookup.ts`
- `src/i18n/referenceLookup.ts`
- `src/i18n/richText.ts`
- `src/i18n/rorAffiliation.ts`
- `src/i18n/sectionStructure.ts`
- `src/components/AccountPanel.tsx`

The final locale-type widening becomes a useful CI gate only after this set is migrated.

## Priority 0 — menus and global navigation

### Completed in the first batch

- `StudioMenu`: **Assignments** and **Signatures** now have explicit values in all 24 locales.
- `Header`: **Search**, **Account**, **Show/Hide document outline**, **Manuscript** now have explicit values in all 24 locales.
- `Header`: account-overlay **Close** now uses the shared translation.
- `DesktopDocumentTabs`: document-tab navigation and close accessibility labels now use shared translations instead of literal English.

### Still open

- `src/components/StudioMenu.tsx` — native Open/Save/Save As/portable-storage labels and Android variants are only EN/HU/DE.
- `src/components/DesktopDocumentOutline.tsx` — local fallback copy.
- `src/mobile/navigation/MobileLayout.tsx` — `Mobile Studio navigation` accessibility label.
- `src/components/SelectionActionToolbar.tsx` — `Selection actions` accessibility label.
- `src/components/LazyBlockEditor.tsx` — deferred-paragraph accessibility label.
- `src/App.tsx` — external manuscript loading/failure text.
- `src/components/Footer.tsx` — tagline, navigation label, documentation/license labels, ORCID environment help and copyright contain direct English strings.

## Priority 1 — Account, identity and administration

- `src/components/AccountPanel.tsx` — page shell, profile tabs, fields/actions: EN/HU/DE local copy.
- `src/components/LinkedIdentitiesSettings.tsx` — connected identities: EN/HU/DE local copy.
- `src/components/InstitutionalProfilesSettings.tsx` — institutional profiles/memberships: EN/HU/DE local copy.
- `src/components/CentralAdministrationSettings.tsx` — central admin/API/audit: EN/HU/DE local copy plus hard-coded English fallback errors.
- `src/components/AuthorSignatureControl.tsx` and `AuthorSignaturePanel.tsx` — EN/HU/DE copy and literal accessibility labels.
- `src/components/OrcidEnvironmentBadge.tsx` — EN/HU/DE conditionals.

These surfaces must be migrated as coherent units so one Account page never switches language mid-form.

## Priority 2 — authentication and recovery

- `src/auth/LoginPage.tsx` — institutional-admin mode, provider buttons, federated errors and several helper texts only EN/HU/DE; product tagline literal English.
- `src/auth/RegisterPage.tsx` — new invitation/provider helper copy only EN/HU/DE; fixed-invitation-email hint literal English; tagline literal English.
- `src/auth/PasswordRecoveryPage.tsx` — recovery/reset copy only EN/HU/DE; tagline literal English.
- `src/store/authStore.ts` — administrator authorization failure includes direct English service error text; classify whether server/error-code translation should replace it.

## Priority 3 — storage and document-language settings

- `src/components/CloudStorageSettings.tsx` — large storage/cloud `COPY` dictionary only EN/HU/DE.
- `src/components/ContentLanguageSettings.tsx` — helper dictionary only EN/HU/DE.
- `src/components/ManuscriptLanguageField.tsx` — helper dictionary only EN/HU/DE.
- `src/model/manuscriptLanguage.ts` — UI-facing language helper contains a three-language map.
- native/system storage and portable/removable storage;
- profile-scoped cloud connections;
- WebDAV/Nextcloud connection setup and backup/restore;
- provider/account-type/method labels and confirmations.

## Priority 4 — integrations, proofreading, translation and agents

- `src/components/IntegrationsPanel.tsx` — authentication/provider labels contain EN/HU/DE conditionals.
- `src/components/OjsAssignmentPanel.tsx` — assignment UI only EN/HU/DE.
- `src/components/ProofreadingSettings.tsx` — only EN/HU/DE.
- `src/components/ProofreadingSuggestionCard.tsx` — only EN/HU/DE.
- `src/components/BlockEditor.tsx` — recent integration/proofreading helper text branches by EN/HU/DE.
- `src/editor/useEditorProofreading.ts` — large-block language-checking warning literal English.
- `src/components/IntegrationExecutionWorkspace.tsx` — extensive direct English UI for AI provider configuration, DeepL translation, OMI agents, extension registry and integration audit.
- `src/components/SelectionIntegrationDialog.tsx` — Translate/Agent/Apply/Scope labels, errors, confirmations and explanatory text are direct English.

## Priority 5 — review/editorial workflows

- `src/components/EditorReviewMode.tsx` — editor-only heading, privacy explanation, author/participant labels, role labels, feedback and empty states are direct English.
- `src/components/ReviewPortal.tsx` — loading and Back to Studio text are direct English.
- review recommendation/status helpers must be checked for full locale coverage.

Double-blind terminology needs careful review: translations must preserve the authorization/privacy meaning and must not expose identity through wording differences.

## Priority 6 — editor, metadata and publishing tools

Confirmed candidates include:

- `src/components/SearchReplaceOverlay.tsx` — result labels use EN/HU/DE helpers.
- `src/components/DesktopUpdatePrompt.tsx` — EN/HU/DE update messages.
- `src/components/EditorPane.tsx` — OJS contributors / corresponding-author literals.
- `src/components/ScholarlyMetadataPanel.tsx` — direct metadata-language accessibility label.
- `src/components/PublisherExportStylesheetPanel.tsx` — EN/HU/DE copy.
- `src/components/PublisherPrintStylesheetPanel.tsx` — EN/HU/DE copy.
- `src/components/PublisherProfileEditor.tsx` — EN/HU/DE copy plus individual layout literals requiring classification.
- insertion/formatting controls, notes, citations, references, DOCX import, history/version controls, document/details mobile navigation.

## Translation helpers requiring individual review

The source scan identifies EN/HU/DE maps or English fallback expressions in these helper modules. Some have supplemental overlays, so do not automatically equate every finding with an untranslated visible string:

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

The raw scanner finds English labels in generated EPUB/HTML/JATS/DTP content, including examples such as `Contents`, `Authors`, `Corresponding author`, `References`, unresolved-reference markers and back-to-note text.

These are not application-menu strings, but they are still localization work. Generated scholarly output should normally derive human-language labels from manuscript/publication language, not the Studio interface language.

## Intentionally untranslated technical content

Do not translate standards, identifiers or provider/product names unless surrounding grammar requires it: `OMI`, `ORCID`, `ROR`, `DOI`, `JATS`, `DOCX`, `EPUB`, `IDML`, `XTG`, `MIF`, `SLA`, `LaTeX`, `WebDAV`, `Nextcloud`, `Google`, `Microsoft`, API scopes, URLs, MIME types and file extensions.

## Completion rule

A surface is complete only when:

1. user-visible text is routed through shared i18n or a deliberately temporary 24-locale map;
2. all 24 locales have explicit reviewed values or documented intentional-identical entries;
3. buttons, menus, tooltips, placeholders, `aria-label`s, confirmations, empty states, errors and success messages are included;
4. dynamic templates do not concatenate untranslated English fragments;
5. no new EN/HU/DE-only helper is introduced;
6. output-document labels are classified separately from application UI strings.

## Work sequence

1. menus/global navigation;
2. Account / linked identities / institution / central admin;
3. login/register/password recovery;
4. storage/cloud/document-language settings;
5. OJS/OMP, ORCID, proofreading, DeepL and agents;
6. review/editorial surfaces;
7. remaining editor/metadata/publishing literals;
8. output-document label localization by manuscript/publication language;
9. widen `SupportedLocale` to all 24 languages and make incomplete maps compile-time errors;
10. make the source audit a strict no-new-untranslated-UI CI gate.

## Progress

- [x] canonical 24-locale list identified;
- [x] current PO completion/in-progress status recorded;
- [x] source-level report-only audit added to tests;
- [x] compile-time three-language core identified;
- [x] first menu batch: Assignments and Signatures in all 24 locales;
- [x] first global-header batch in all 24 locales;
- [x] desktop-tab accessibility labels routed through shared translations;
- [ ] native storage/menu labels migrated;
- [ ] Account/identity/admin migrated;
- [ ] auth/recovery migrated;
- [ ] storage/cloud migrated;
- [ ] integrations/review/editor candidates classified and migrated;
- [ ] output-language labels localized;
- [ ] `SupportedLocale` widened safely to all 24 locales;
- [ ] strict CI untranslated-UI gate enabled.
