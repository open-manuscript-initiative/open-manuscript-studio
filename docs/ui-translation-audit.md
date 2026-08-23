# Studio UI translation audit

Snapshot: 2026-08-23

This document tracks user-visible Studio strings that are not yet fully routed through the 24-locale translation system. It exists alongside the canonical PO catalogue audit: catalogue parity alone is insufficient because recent UI work introduced several component-local English/Hungarian/German dictionaries and a small number of direct JSX strings.

## Supported UI locales

`bg`, `cs`, `da`, `de`, `el`, `en`, `es`, `et`, `fi`, `fr`, `ga`, `hr`, `hu`, `it`, `lt`, `lv`, `mt`, `nl`, `pl`, `pt`, `ro`, `sk`, `sl`, `sv`.

The PO policy currently marks these non-English catalogues complete: **bg, cs, da, de, fr, hu, it**. The remaining 17 non-English catalogues are still explicitly marked **in progress**: **el, es, et, fi, ga, hr, lt, lv, mt, nl, pl, pt, ro, sk, sl, sv** plus any future locale not promoted to complete status. This catalogue status does not cover component-local strings listed below.

## Priority 0 — menus and global navigation

| Surface | Source | Current problem | Required action |
|---|---|---|---|
| Manuscript menu — Assignments | `src/components/StudioMenu.tsx` | EN/HU/DE local conditional | Route through 24-locale UI translation |
| Manuscript menu — Signatures | `src/components/StudioMenu.tsx` | EN/HU/DE local conditional | Route through 24-locale UI translation |
| Native Open/Save/Save As/portable-storage labels | `src/components/StudioMenu.tsx` | `getLocalFileLabels()` only has EN/HU/DE, including Android variants | Move to shared catalogue and translate all locales |
| Storage and cloud connections | `src/components/CloudStorageSettings.tsx` | `COPY` contains only EN/HU/DE | Move all storage labels, hints, confirmations and status messages to shared catalogue |
| Login mode switch | `src/auth/LoginPage.tsx` | personal/institution-admin copy only EN/HU/DE | Add all locales |
| Login hero, provider buttons and federated errors | `src/auth/LoginPage.tsx` | helper functions fall back to English outside HU/DE | Move to shared auth catalogue and translate all locales |

## Priority 1 — Account

| Surface | Source | Current problem |
|---|---|---|
| Account page shell and profile tabs | `src/components/AccountPanel.tsx` | local `copy` only EN/HU/DE |
| Connected identities | `src/components/LinkedIdentitiesSettings.tsx` | local `copy` only EN/HU/DE |
| Institutional profiles | `src/components/InstitutionalProfilesSettings.tsx` | local `copy` only EN/HU/DE |
| Central administration | `src/components/CentralAdministrationSettings.tsx` | local `copy` only EN/HU/DE; two fallback error messages are hard-coded English |
| Password recovery | `src/auth/PasswordRecoveryPage.tsx` | `getCopy()` only HU/DE/EN and English product tagline is literal JSX |

Account strings include headings, descriptions, form labels, hints, role names, state labels, confirmation dialogs, success/error messages, API credential controls and accessibility labels. They must be translated as one unit so a page never switches language mid-form.

## Priority 2 — storage, integration and service settings

The following groups require a full scan because their visible copy grew substantially during beta-readiness work:

- native/system storage and portable/removable storage;
- profile-scoped cloud connections;
- WebDAV/Nextcloud connection setup and backup/restore;
- provider/account-type/method labels;
- OAuth provider status and explanatory text;
- OJS/OMP assignment/integration panels;
- DeepL, proofreading and AI-agent settings/status/error surfaces;
- ORCID environment/linking/signature status surfaces.

The first confirmed high-debt file in this group is `src/components/CloudStorageSettings.tsx`.

## Priority 3 — editor and document tools

Audit all user-visible strings in:

- insert/formatting controls and tooltips;
- document tree / outline / tabs;
- search and replace;
- notes, citations, references and contributors;
- DOCX import;
- publication profile and export panels;
- author signatures;
- history/version controls;
- document/details mobile navigation;
- settings and help.

Most older surfaces already use `t(...)` or shared locale helpers; the audit must distinguish those from component-local fallbacks and direct literals rather than blindly translating technical identifiers.

## Do not translate as UI prose

Keep standards, identifiers and provider/product names unchanged unless grammar requires surrounding translated text: `OMI`, `ORCID`, `ROR`, `DOI`, `JATS`, `DOCX`, `EPUB`, `IDML`, `XTG`, `MIF`, `SLA`, `LaTeX`, `WebDAV`, `Nextcloud`, `Google`, `Microsoft`, API scopes, URLs, MIME types, file extensions and role enum values when they are shown as technical values rather than labels.

## Audit rules

A UI string is considered complete only when:

1. it is routed through the shared i18n layer (or a deliberately temporary supplemental 24-locale map);
2. every supported locale has an explicit reviewed value or a documented intentional-identical allow-list entry;
3. buttons, menu items, tooltips, placeholders, `aria-label`s, confirmations, empty states, errors and success messages are included;
4. dynamic templates do not concatenate untranslated English fragments;
5. no new EN/HU/DE-only helper is introduced.

## Work sequence

1. **Menus/global navigation** — remove visible English fallbacks first.
2. **Account/identity/admin** — migrate the entire account surface together.
3. **Storage/cloud** — migrate the full storage dictionary together.
4. **Authentication/recovery** — complete all 24 locale variants.
5. **Integration and advanced tools** — OJS/OMP, ORCID, proofreading, DeepL, agents.
6. **Full raw-literal scan** — resolve or explicitly allow every remaining candidate.
7. **CI gate** — once the baseline is clean, make newly introduced untranslated UI literals and partial locale maps a build failure.

## Progress

- [x] Canonical 24-locale list identified.
- [x] PO catalogue completion policy separated from UI-literal coverage.
- [x] Recent menu/account/storage/auth translation debt inventoried.
- [x] First menu translation batch started in the same change set.
- [ ] Account/identity/admin moved to the shared 24-locale catalogue.
- [ ] Storage/cloud dictionary moved to the shared 24-locale catalogue.
- [ ] Login/password-recovery helper copy moved to shared translations.
- [ ] Integration/editor raw-literal audit completed.
- [ ] All 24 locales reviewed.
- [ ] Strict CI untranslated-UI gate enabled.
