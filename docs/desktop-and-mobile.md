# Open Manuscript Studio desktop and mobile builds

Open Manuscript Studio uses one React/Vite application for the web and native shells. The native application layer is implemented with Tauri 2.

## Architecture

The web application remains the canonical Studio frontend. `src-tauri/` contains only the native shell and platform integration layer. This separation allows normal Studio development to continue without maintaining separate Windows, macOS, Linux, or Android application forks.

The OMI manuscript schema version is intentionally independent from the Studio application version. Native applications must continue to read older supported OMI documents and migrate them explicitly when a schema migration is required.

## Web development

```bash
npm ci
npm run dev
```

The existing web deployment is unchanged.

## Desktop development

Prerequisites:

- Node.js 22 or a compatible current LTS release
- Rust stable
- the platform prerequisites required by Tauri 2

Run the native shell in development mode:

```bash
npm ci
npm run desktop:dev
```

Build an installer/package for the current operating system:

```bash
npm run desktop:build
```

Tauri places generated desktop bundles below `src-tauri/target/release/bundle/`.

Typical outputs are:

- Windows: MSI and/or NSIS installer
- Linux: AppImage and DEB packages when supported by the build host
- macOS: application bundle and DMG when supported by the build host

## GitHub Actions desktop builds

The `Tauri Desktop Builds` workflow is intentionally manual during the alpha phase. Run it from GitHub Actions using **Run workflow**.

It builds and stores workflow artifacts for:

- Windows x86-64
- Linux x86-64
- macOS Apple Silicon
- macOS Intel

The workflow runs the Studio test suite before packaging each native build.

Release publication and automatic updates are intentionally not enabled yet. Tauri updater artifacts must be cryptographically signed. The signing private key must be generated and stored securely before installed clients are allowed to auto-update.

## Android preparation

Tauri 2 uses the same frontend for Android. Android development additionally requires the Android SDK, NDK, Java/Kotlin tooling and the Rust Android targets.

After installing the platform prerequisites, initialize the generated Android project once:

```bash
npm run android:init
```

Development build:

```bash
npm run android:dev
```

Release build:

```bash
npm run android:build
```

The Android UI should remain responsive and may use platform-specific layout adaptations, but it must consume the same OMI document model and shared Studio feature modules.

## Native file integration

The first Tauri milestone provides the cross-platform shell and build pipeline. Native file open/save integration should be added through narrowly scoped Tauri permissions rather than enabling broad filesystem access. Browser builds must keep their current download/upload behavior as a fallback.

Planned native operations include:

- open `.omi` and `.omi.json`
- save manuscripts to a selected local path
- import DOCX through the native file picker
- export DOCX, JATS, HTML, EPUB, IDML, XTG, MIF, SLA and LaTeX to a selected path

## Versioning

Keep these versions conceptually separate:

- Studio application version: distributed software release
- OMI schema/model version: portable document contract

A Studio release may change without changing the OMI schema. An OMI schema change must have an explicit migration path.
