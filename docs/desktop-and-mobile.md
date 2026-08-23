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

### Android document storage

Android uses the system Storage Access Framework / Documents picker instead of exposing arbitrary filesystem paths to Studio. This gives the author explicit control over each opened or created document without requesting broad shared-storage permissions.

The Android save workflow provides:

- **Save**: writes the current manuscript back to the document selected during the current app session;
- **Save to another location**: opens the Android system save picker and establishes the newly selected document as the current manuscript location;
- **OMI backup**: builds the portable `.omi.zip` package and lets the author place it through the Android system picker;
- supported publication exports use the same system picker.

The Android picker can expose device storage, Downloads, SD cards and document providers supplied by installed storage applications. Studio does not hard-code or require credentials for those providers.

Android returns `content://` document URIs rather than desktop filesystem paths. These URIs are treated as implementation details and are not shown to users as filenames. Access granted by the picker is scoped to the selected document and the current native permission scope.

Android file filters use MIME types, because extension-based filtering is not generally supported by the platform document picker.

### Android export surface

Only formats that are meaningful and supported in the Android workflow are shown:

- portable OMI package (`.omi.zip`)
- OMI JSON (`.omi.json`)
- JATS XML (`.xml`)
- HTML package (`.html.zip`)
- DOCX (`.docx`)
- LaTeX (`.tex`)
- EPUB (`.epub`)

Desktop-oriented publishing formats are hidden from Android rather than appearing as non-functional choices:

- IDML
- XTG
- MIF
- SLA
- browser print/PDF export

They remain available on the platforms where their workflows are supported.

## Native file integration

Native file open/save integration uses narrowly scoped Tauri permissions rather than broad filesystem access. Browser builds retain their download/upload behavior as a fallback.

Native operations include:

- open `.omi` and `.omi.json` manuscripts;
- save manuscripts through the platform-native file/document picker;
- import DOCX through the native file picker;
- export the formats supported by the current platform to a user-selected destination.

Desktop installations can additionally work with normal filesystem paths such as locally synchronized cloud folders, NAS mounts and external drives. Android uses document-provider access instead of desktop-style folder paths.

## Versioning

Keep these versions conceptually separate:

- Studio application version: distributed software release
- OMI schema/model version: portable document contract

A Studio release may change without changing the OMI schema. An OMI schema change must have an explicit migration path.
