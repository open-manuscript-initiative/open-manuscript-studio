# Open Manuscript Studio Wiki

Open Manuscript Studio is the open-source reference implementation of the [Open Manuscript Initiative (OMI)](https://openmanuscript.org/): a structured, multilingual scholarly authoring environment for writing, reviewing, exchanging, and preparing manuscripts for publication without locking them to one application, operating system, or publishing platform.

> **Current release line:** `0.1.0-beta.2` · public beta
>
> **Principle:** Write naturally. Structure once. Publish everywhere.

## Start here

| I want to… | Wiki page |
| --- | --- |
| use or run Studio | [[Getting Started]] |
| understand the system | [[Architecture]] |
| contribute code or documentation | [[Contributing]] |
| operate the API and PostgreSQL databases | [[Database and Server]] |
| build desktop or mobile packages | [[Build and Release]] |
| connect publishing, identity, storage, or language services | [[Integrations]] |
| see the path from beta to release candidate | [[Roadmap]] |

## Current platform status

| Platform | State |
| --- | --- |
| Web | Operational hosted Studio |
| Windows x64 | Operational; EXE and MSI build paths |
| Linux x64 | Automated AppImage and DEB builds |
| macOS Apple Silicon / Intel | Automated DMG builds; signing and notarization hardening continues |
| Android | Operational public beta with the system document picker |
| iOS / iPadOS | Native simulator build validated; distribution signing and physical-device validation remain |

All clients share the React/TypeScript application core and the portable OMI manuscript model. Tauri 2 supplies native desktop and mobile integration; the Node.js API and PostgreSQL provide account, review, institutional, and integration services.

## Documentation map

The Wiki is the maintained navigation and operational overview. Detailed, code-adjacent documentation remains versioned with the implementation:

- [Repository README](https://github.com/open-manuscript-initiative/open-manuscript-studio#readme) — capabilities, platform status, and development commands
- [Repository documentation](https://github.com/open-manuscript-initiative/open-manuscript-studio/tree/main/docs) — implementation and deployment notes
- [OMI website and specifications](https://openmanuscript.org/) — stable public architecture, governance, and format documentation
- [Release notes](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/CHANGELOG.md)
- [Issue tracker](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues)
- [Security policy](https://github.com/open-manuscript-initiative/open-manuscript-studio/security/policy)

## Project boundary

Studio is a reference implementation, not a proprietary replacement for the OMI specifications. Application releases, native package build numbers, and OMI schema versions are deliberately versioned separately. A Studio update does not automatically imply a manuscript-format migration.

Open Manuscript Studio is distributed under the [MIT License](https://github.com/open-manuscript-initiative/open-manuscript-studio/blob/main/LICENSE).
