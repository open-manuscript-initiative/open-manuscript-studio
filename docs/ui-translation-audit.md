# Studio UI translation audit

Snapshot: 2026-08-23

This document tracks user-visible Studio strings that are not yet fully routed through the 24-locale translation system. It exists alongside the canonical PO catalogue audit: catalogue parity alone is insufficient because recent UI work introduced several component-local English/Hungarian/German dictionaries and direct JSX/user-message strings.

## Supported UI locales

`bg`, `cs`, `da`, `de`, `el`, `en`, `es`, `et`, `fi`, `fr`, `ga`, `hr`, `hu`, `it`, `lt`, `lv`, `mt`, `nl`, `pl`, `pt`, `ro`, `sk`, `sl`, `sv`.

The TypeScript `SupportedLocale` type must contain exactly this set. It historically remained `en | hu | de` after runtime language support expanded, which made new three-language local dictionaries deceptively easy to introduce.

## Canonical PO catalogue status

The current canonical PO audit contains **722 entries per locale**.

### Complete non-English catalogues

**bg, cs, da, de, es, fr, hu, it, nl, pl, pt**

### Explicitly in-progress catalogues

**el, et, fi, ga, hr, lt, lv, mt, ro, sk, sl, sv**

`en` is the reference/source locale.

Current audit details:

- `el`: 721/722 translated (99.9%)
- `et`: 721/722 translated (99.9%)
- `fi`: 722/722 translated but still policy-marked in progress pending review/promotion
- `ga`: 722/722 translated but still policy-marked in progress pending review/promotion
- `hr`: 266/722 translated (36.8%)
- `lt`: 266/722 translated (36.8%)
- `lv`: 266/722 translated (36.8%)
- `mt`: 257/722 translated (35.6%)
- `ro`: 255/722 translated (35.3%)
- `sk`: 261/722 translated (36.1%)
- `sl`: 264/722 translated (36.6%)
- `sv`: 258/722 translated (35.7%)

Across the canonical PO audit there are currently **3,685 identical-to-English candidates**, **4,616 reviewed overlay values**, **0 empty translations** and **0 structurally invalid locales**.

This status covers only strings already inside the canonical catalogue. It does **not** prove that every visible Studio string is in that catalogue.

## Source-level UI audit

A report-only scanner now checks `src/**/*.ts(x)` for two important forms of translation debt:

1. locale maps/conditionals that visibly only handle EN/HU/DE or otherwise fall back to English;
2. direct JSX labels, accessibility labels and user-facing messages that may bypass i18n.

The first run reports:

- **89 limited-locale-map candidates**;
- **1,094 raw direct-literal candidates** across **172 files**.

The direct-literal number is deliberately called **raw**: it contains false positives from TypeScript, render templates and export generators and therefore is not the final number of strings that need translation. Every candidate must be classified as one of:

- UI prose requiring translation;
- accessibility text requiring translation;
- exported-document language requiring separate localization policy;
- technical/standards identifier intentionally left unchanged;
- scanner false positive.

The 89 limited-locale-map candidates are a much stronger migration signal and should be eliminated systematically.

## Priority 0 — menus and global navigation

| Surface | Source | Current problem | Required action |
|---|---|---|---|
| Manuscript menu — Assignments | `src/components/StudioMenu.tsx` | Was EN/HU/DE only | **24-locale translation added in this work** |
| Manuscript menu — Signatures | `src/components/StudioMenu.tsx` | Was EN/HU/DE only | **24-locale translation added in this work** |
| Native Open/Save/Save As/portable-storage labels | `src/components/StudioMenu.tsx` | `getLocalFileLabels()` only has EN/HU/DE, including Android variants | Move to shared catalogue and translate all locales |
| Desktop document tabs | `src/components/DesktopDocumentTabs.tsx` | `Open documents` / `Close` accessibility labels are literal English | Route through shared translation |
| Header / account overlay | `src/components/Header.tsx` | `Manuscript` and `Close` remain direct English literals in places | Route through shared translation |
| Mobile navigation | `src/mobile/navigation/MobileLayout.tsx` | `Mobile Studio navigation` accessibility label is literal English | Route through shared translation |
| Selection toolbar | `src/components/SelectionActionToolbar.tsx` | `Selection actions` accessibility label is literal English | Route through shared translation |
| Deferred large-document editor | `src/components/LazyBlockEditor.tsx` | deferred paragraph accessibility label is literal English | Route through shared translation |

## Priority 1 — Account, identity and administration

| Surface | Source | Current problem |
|---|---|---|
| Account page shell and profile tabs | `src/components/AccountPanel.tsx` | local `copy` falls back to EN outside HU/DE |
| Connected identities | `src/components/LinkedIdentitiesSettings.tsx` | local `copy` falls back to EN outside HU/DE |
| Institutional profiles | `src/components/InstitutionalProfilesSettings.tsx` | local `copy` falls back to EN outside HU/DE |
| Central administration | `src/components/CentralAdministrationSettings.tsx` | local `copy` falls back to EN outside HU/DE; fallback API errors include hard-coded English |
| Author signature launcher/panel | `src/components/AuthorSignatureControl.tsx`, `AuthorSignaturePanel.tsx` | EN/HU/DE helpers and literal `Close` |
| ORCID environment status | `src/components/OrcidEnvironmentBadge.tsx` | EN/HU/DE conditionals |

Account strings include headings, descriptions, form labels, hints, role names, state labels, confirmation dialogs, success/error messages, API credential controls and accessibility labels. Each account surface should be migrated as a unit so a page never changes language mid-form.

## Priority 2 — authentication and recovery

| Surface | Source | Current problem |
|---|---|---|
| Login mode / institutional admin sign-in | `src/auth/LoginPage.tsx` | several helpers only EN/HU/DE |
| Login provider buttons / federated errors | `src/auth/LoginPage.tsx` | English fallback outside HU/DE |
| Login product tagline | `src/auth/LoginPage.tsx` | direct English JSX |
| Registration supplemental copy | `src/auth/RegisterPage.tsx` | recent invitation/provider copy only EN/HU/DE |
| Invitation fixed-email hint | `src/auth/RegisterPage.tsx` | direct English JSX |
| Password recovery | `src/auth/PasswordRecoveryPage.tsx` | `getCopy()` only HU/DE/EN and direct English tagline |

## Priority 3 — storage, integration and service settings

Confirmed high-debt groups:

- `src/components/CloudStorageSettings.tsx` — large storage/cloud `COPY` object only EN/HU/DE;
- `src/components/ContentLanguageSettings.tsx` — settings helper only EN/HU/DE;
- `src/components/ManuscriptLanguageField.tsx` — helper copy only EN/HU/DE;
- `src/components/IntegrationsPanel.tsx` — authentication-mode/provider labels contain EN/HU/DE conditionals;
- `src/components/OjsAssignmentPanel.tsx` — assignment copy only EN/HU/DE;
- `src/components/ProofreadingSettings.tsx` and `ProofreadingSuggestionCard.tsx` — EN/HU/DE copy;
- `src/components/IntegrationExecutionWorkspace.tsx` — AI provider, DeepL, OMI agents, extension registry and integration audit workspace contains a large block of direct English UI;
- `src/components/SelectionIntegrationDialog.tsx` — direct English translation/agent labels, errors, confirmations and explanatory text.

Storage/integration audit must cover:

- native/system storage and portable/removable storage;
- profile-scoped cloud connections;
- WebDAV/Nextcloud connection setup and backup/restore;
- provider/account-type/method labels;
- OAuth provider status and explanatory text;
- OJS/OMP assignment/integration panels;
- DeepL, proofreading and AI-agent settings/status/error surfaces;
- ORCID environment/linking/signature status surfaces.

## Priority 4 — review and editorial workflows

Confirmed direct English surfaces include:

- `src/components/EditorReviewMode.tsx` — editor-only assignment heading, privacy description, author/participant labels, empty states and feedback labels;
- `src/components/ReviewPortal.tsx` — loading and “Back to Studio” text;
- review recommendation/status helpers must also be checked for locale completeness rather than only key parity.

Because these surfaces enforce double-blind boundaries, translations must preserve role terminology precisely and must not accidentally expose identity information through differently worded labels.

## Priority 5 — editor and document tools

Confirmed or suspected groups requiring classification/migration:

- `src/components/BlockEditor.tsx` — recent integration/proofreading copy contains EN/HU/DE branching;
- `src/components/SearchReplaceOverlay.tsx` — result labels/copy use EN/HU/DE helpers;
- `src/components/DesktopDocumentOutline.tsx` — local fallback copy;
- `src/components/DesktopUpdatePrompt.tsx` — EN/HU/DE update messages;
- `src/components/EditorPane.tsx` — OJS contributors/corresponding-author literals;
- insert/formatting controls and tooltips;
- notes, citations, references and contributors;
- DOCX import;
- publication profile and publisher style editors;
- history/version controls;
- document/details mobile navigation;
- settings and help.

## Helper translation modules that require review

The source audit also identifies several `src/i18n/*` helpers that contain EN/HU/DE maps or an English fallback expression. They must be inspected individually because some already have supplemental completion overlays and are not necessarily missing visible translations:

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

`help.ts` is also flagged by the simple pattern scan, but dedicated help-localization tests already verify substantial localized help for all 24 locales and no silent English fallback. It therefore requires classification, not automatic migration.

## Exported-document language is a separate category

The raw scan also finds English strings used inside generated EPUB/HTML/JATS/DTP output, for example headings such as `Contents`, `Authors`, `Corresponding author` or `References`. These are **not menu/UI strings**, but they should not be ignored. They require a separate policy: generated scholarly output should derive such labels from manuscript/publication language rather than interface language wherever appropriate.

## Do not translate as UI prose

Keep standards, identifiers and provider/product names unchanged unless grammar requires surrounding translated text: `OMI`, `ORCID`, `ROR`, `DOI`, `JATS`, `DOCX`, `EPUB`, `IDML`, `XTG`, `MIF`, `SLA`, `LaTeX`, `WebDAV`, `Nextcloud`, `Google`, `Microsoft`, API scopes, URLs, MIME types, file extensions and role enum values when they are shown as technical values rather than labels.

## Audit rules

A UI string is considered complete only when:

1. it is routed through the shared i18n layer (or a deliberately temporary supplemental 24-locale map);
2. every supported locale has an explicit reviewed value or a documented intentional-identical allow-list entry;
3. buttons, menu items, tooltips, placeholders, `aria-label`s, confirmations, empty states, errors and success messages are included;
4. dynamic templates do not concatenate untranslated English fragments;
5. no new EN/HU/DE-only helper is introduced;
6. generated/exported-document labels are classified separately from application UI strings.

## Work sequence

1. **Menus/global navigation** — remove visible English fallbacks first.
2. **Account/identity/admin** — migrate the entire account surface together.
3. **Authentication/recovery** — complete all 24 locale variants.
4. **Storage/cloud** — migrate the full storage dictionary together.
5. **Integration and advanced tools** — OJS/OMP, ORCID, proofreading, DeepL, agents.
6. **Review/editorial workflows** — eliminate direct English reviewer/editor UI.
7. **Full raw-literal classification** — resolve or explicitly allow every remaining candidate.
8. **Export-label localization policy** — derive output-language labels appropriately.
9. **CI gate** — once the baseline is classified/clean, make newly introduced untranslated UI literals and partial locale maps a build failure.

## Progress

- [x] Canonical 24-locale list identified.
- [x] Type-level locale model expanded from EN/HU/DE to all 24 locales.
- [x] PO catalogue completion policy separated from UI-literal coverage.
- [x] Source-level report-only audit added.
- [x] Recent menu/account/storage/auth/integration translation debt inventoried.
- [x] First menu translation batch: Assignments and Signatures in all 24 locales.
- [ ] Native storage/menu labels moved to 24-locale catalogue.
- [ ] Account/identity/admin moved to the shared 24-locale catalogue.
- [ ] Login/register/password-recovery supplemental copy moved to shared translations.
- [ ] Storage/cloud dictionary moved to the shared 24-locale catalogue.
- [ ] Integration/review/editor raw-literal candidates classified and migrated.
- [ ] Export-language labels classified/localized by manuscript/publication language.
- [ ] All 24 locales reviewed.
- [ ] Strict CI untranslated-UI gate enabled.
