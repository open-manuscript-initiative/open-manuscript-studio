# Open Manuscript Studio

Open Manuscript Studio is the open-source reference implementation of the **Open Manuscript Initiative (OMI)**. It provides a structured, multilingual scholarly authoring environment for writing, reviewing, exchanging and preparing manuscripts for publication.

> **Status:** active alpha development. The Studio is usable today, but interfaces, schemas and connected-service behaviour may still change before OMI 1.0.

## Current capabilities

The current development line includes substantially more than the original editor prototype:

- structured scholarly manuscript editing with semantic document sections;
- rich-text editing with headings, lists, tables, notes, citations and inline formatting;
- structured search and replace with scoped navigation;
- server-backed user accounts and role-aware workflows;
- contributor metadata, affiliations and identity handling;
- ORCID sign-in/linking when OAuth is configured by the installation;
- 24 supported interface languages and localized help;
- double-blind peer review with author, reviewer and editor views;
- review assignments, manuscript snapshots, reviewer comments and editorial review overview;
- OJS integration for launch context, assignments, manuscript files and metadata;
- structured DOCX import preserving headings, inline semantics, notes, references and tables;
- provider-based integrations including WebDAV/Nextcloud storage foundations;
- publisher profiles, export styles and print styles;
- broad publishing/export support including JATS XML, HTML5, DOCX, EPUB, PDF, IDML, XPress Tags, FrameMaker MIF, Scribus SLA and LaTeX;
- native desktop builds for Windows, Linux, Intel macOS and Apple Silicon;
- desktop update notification and installer workflow.

Some integrations are **configuration-dependent**. Others, such as additional translation or publishing providers, may still be foundation-level or specification-first rather than production-complete.

## Web application

The hosted Studio is available at:

**https://studio.openmanuscript.org**

The web application and desktop application share the same core manuscript model and user interface. Server-backed features such as accounts, collaboration, peer review and publishing-system integrations require an online installation.

## Desktop applications

Official desktop packages are produced automatically through GitHub Actions for:

- **Windows x64** — Setup `.exe` and `.msi`;
- **Linux x64** — `.AppImage` and `.deb`;
- **macOS Apple Silicon** — `.dmg`;
- **macOS Intel** — `.dmg`.

Downloads are published on the GitHub Releases page and linked from the OMI Studio page:

**https://openmanuscript.org/studio/**

The desktop application follows a **local-first** approach. Manuscripts can be stored on the user's own computer, a network drive or a cloud-synchronized folder. Connected services extend the workflow without making the manuscript dependent on a single provider.

### Windows signing status

Desktop release automation is operational. The project is preparing trusted Windows Authenticode signing through SignPath Foundation. Until trusted signing is active, Windows may display an unknown-publisher or reputation warning for installers.

**Code signing policy:** https://openmanuscript.org/docs/governance/code-signing-policy/

Free code signing provided by SignPath.io, certificate by SignPath Foundation.

## Supported interface languages

The Studio currently supports 24 UI languages:

`bg`, `cs`, `da`, `de`, `el`, `en`, `es`, `et`, `fi`, `fr`, `ga`, `hr`, `hu`, `it`, `lt`, `lv`, `mt`, `nl`, `pl`, `pt`, `ro`, `sk`, `sl`, `sv`.

All supported languages are available on the sign-in screen.

## OJS integration

Open Manuscript Studio can participate in an OJS-connected editorial workflow through the OMI OJS integration layer. Current work includes:

- signed launch context;
- manuscript and metadata import;
- structured DOCX transfer;
- assignment-aware author/reviewer/editor workflows;
- peer-review integration;
- return of work through the integration workflow.

The OJS integration remains configuration-dependent and requires the corresponding server and OJS plugin setup.

## Technology stack

- React
- TypeScript
- Vite
- Zustand
- Tiptap
- Tauri 2
- Rust
- Node.js server components
- PostgreSQL-backed server services

## Development setup

Requirements:

- Node.js 22
- npm
- Rust toolchain for Tauri desktop development

Install dependencies:

```bash
npm ci
```

Run the web development server:

```bash
npm run dev
```

Open the URL printed by Vite, usually `http://localhost:5173`.

Run tests:

```bash
npm test
```

Build the web application:

```bash
npm run build
```

The production web output is generated in `dist/`.

Build Tauri desktop bundles according to the platform-specific Tauri prerequisites:

```bash
npm run tauri -- build
```

## Releases

Desktop releases are built by `.github/workflows/tauri-desktop.yml`. The workflow produces platform-specific artifacts and publishes the current release with stable download filenames used by the OMI website.

Release versioning is still in the alpha series. See the GitHub Releases page for the current public build.

## Documentation

OMI specifications, architecture, implementation status and integration documentation are maintained at:

**https://openmanuscript.org/**

Useful project documents include:

- `SECURITY.md` — vulnerability reporting and release security;
- `CONTRIBUTING.md` — contribution guidelines;
- `CODE_OF_CONDUCT.md` — community standards;
- `LICENSE` — MIT License.

## Project principle

Open Manuscript Studio is a **reference implementation**, not a proprietary replacement for the OMI standard. Its purpose is to test the specifications in real authoring, peer-review, editorial and publishing workflows while keeping scholarly manuscripts structured, portable and interoperable.

**Write naturally. Structure once. Publish everywhere.**
