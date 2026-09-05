# Roadmap

Open Manuscript Studio is on the `0.1.0-beta.2` public beta line. The authoring, account, review, import/export, native packaging, and institutional administration layers are implemented; the next milestone is a stable release candidate.

This page records direction rather than promising dates. The [issue tracker](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues), pull requests, and [CHANGELOG](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/CHANGELOG.md) are the authoritative sources for individual work items.

## Implemented foundation

- semantic OMI manuscript editing with stable structured data;
- study and volume workflows, metadata, notes, references, indexes, and cross-references;
- Word-like continuous editing and a live publication editor;
- paragraph/publication styles, page setup, hyphenation, tracked changes, and comments;
- DOCX/PDF import paths and multi-format publication export;
- local accounts, linked identity providers, profiles, and institutional administration;
- double-blind review workspaces and assignment-aware OJS integration;
- web, desktop, Android, and validated iOS/iPadOS simulator targets;
- portable local/native storage and profile-scoped cloud connections;
- localization and help infrastructure across the supported interface languages;
- automated unit/model, browser, native-build, security, and PKP integration checks.

## Active beta stabilization

### Editing and import fidelity

- eliminate regressions in responsive menus, document tabs, and mobile open/close behavior;
- improve large-manuscript performance and progressive editor mounting;
- continue DOCX/PDF structural fidelity for headings, notes, lists, tables, references, and inline semantics;
- harden recovery, autosave, multi-document session restoration, and migration behavior.

### Publishing and review interoperability

- complete OMP end-to-end parity for press, monograph, and study review contexts;
- consume publishing-system-native review form and recommendation options without lossy remapping;
- strengthen multi-round review isolation and signed writeback;
- expand reproducible OJS/OMP installation-level workflow fixtures and conformance tests.

### Distribution and platform quality

- finish macOS signing/notarization and trusted update delivery;
- complete physical-device, Universal Link, TestFlight, and App Store validation for iOS/iPadOS;
- continue Android release, app-link, and device-matrix validation;
- resolve upstream native dependency advisories when compatible Tauri/GTK updates become available.

### Quality, accessibility, and operations

- expand Playwright coverage across phone, tablet, and desktop breakpoints;
- improve keyboard, screen-reader, focus, and high-contrast behavior;
- tighten error reporting without leaking manuscript, identity, or integration data;
- verify PostgreSQL migrations, backup/restore, and deployment rollback paths;
- maintain localization parity and terminology quality.

## Release-candidate exit criteria

- all required CI and platform matrices are green for the candidate commit;
- no known data-loss, authorization, anonymity, or format-migration blocker remains;
- supported import/export round trips preserve the required semantic structure;
- deployment and recovery procedures have been exercised from clean installations;
- official artifacts have verifiable provenance and the required platform signatures;
- public documentation matches the delivered feature boundary;
- remaining limitations are explicit and do not contradict the advertised platform status.

## Longer-term direction

- reusable OMI interoperability libraries and conformance tooling;
- broader publishing, repository, identity, and storage connectors;
- portable scholarly identity without centralizing manuscripts or review graphs;
- mature collaborative editing with explicit conflict and version semantics;
- stable, documented OMI schema evolution and renderer compatibility profiles.
