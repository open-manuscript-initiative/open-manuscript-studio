# Open Manuscript Studio desktop and mobile builds

Open Manuscript Studio uses one React/Vite application for the web and native shells. The native application layer is implemented with Tauri 2.

## Architecture

The web application remains the canonical Studio frontend. `src-tauri/` contains only the native shell and platform integration layer. This separation allows normal Studio development to continue without maintaining separate Windows, macOS, Linux, Android, iOS, or iPadOS application forks.

The OMI manuscript schema version is intentionally independent from the Studio application version. Native applications must continue to read older supported OMI documents and migrate them explicitly when a schema migration is required.

## Web development

```bash
npm ci
npm run dev
```

The existing web deployment is unchanged.

## Desktop development

Prerequisites:

- Node.js 24 or a compatible current release
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

The `Tauri Desktop Builds` workflow builds and stores workflow artifacts for:

- Windows x86-64
- Linux x86-64
- macOS Apple Silicon
- macOS Intel

The workflow runs the Studio test suite before packaging each native build.

Tauri updater artifacts must be cryptographically signed before installed clients are allowed to auto-update.

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

## iOS and iPadOS preparation

The iPhone/iPad application uses the same Tauri 2 mobile shell and Studio frontend. Development requires macOS, Xcode, CocoaPods and the Rust iOS targets.

```bash
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

An Apple Development Team ID is required by Xcode/Tauri:

```bash
export APPLE_DEVELOPMENT_TEAM=YOUR_TEAM_ID
```

Initialize the generated Apple project:

```bash
npm run ios:init
```

Run an Apple Silicon simulator:

```bash
npm run ios:simulator
```

Build a simulator artifact:

```bash
npm run ios:build:simulator
```

Build a signed App Store Connect IPA after configuring the required Apple signing credentials:

```bash
npm run ios:build:app-store
```

The iOS-specific Tauri configuration uses the bundle identifier `org.openmanuscript.studio`, minimum system version 14.0, App Store short version `0.1.0` and build number `4`. The Studio release line remains `0.1.0-alpha.4` in product/release metadata.

### iOS/iPadOS document storage

iOS and iPadOS use the system Files / UIDocumentPicker surface. The user can select locations exposed by Files such as On My iPhone/On My iPad, iCloud Drive, external storage and compatible third-party file providers.

When opening a manuscript, Studio explicitly requests document-picker mode and security-scoped access. The Tauri dialog layer returns `file://` document URLs and the filesystem plugin reads/writes those URLs directly. Studio therefore does not require broad device storage permissions.

The same own-device/shared-device policy applies as on the other native clients: a trusted personal device may use normal system storage; on a shared device normal persistent local-path association is disabled and portable one-off storage remains possible.

### Mobile export surface

Android, iOS and iPadOS expose the same mobile-focused export choices:

- portable OMI package (`.omi.zip`)
- OMI JSON (`.omi.json`)
- JATS XML (`.xml`)
- HTML package (`.html.zip`)
- DOCX (`.docx`)
- LaTeX (`.tex`)
- EPUB (`.epub`)

Desktop-oriented publishing formats are hidden from mobile rather than appearing as non-functional choices:

- IDML
- XTG
- MIF
- SLA
- browser print/PDF export

They remain available on the platforms where their workflows are supported.

### iOS/iPadOS authentication return

ORCID and OIDC sign-in use the same one-time native handoff as Android. The production return target is the verified Universal Link at `https://app.openmanuscript.org/auth/orcid/`, with `openmanuscript://auth/` retained as a custom-scheme fallback.

Before public iOS distribution, `app.openmanuscript.org` must publish a valid `/.well-known/apple-app-site-association` file containing the real Apple Development Team ID and `org.openmanuscript.studio`. The Team ID cannot be generated by Studio and must come from the Apple Developer account.

See [iOS and iPadOS](./ios-ipados.md) for the complete build, signing and Universal Link procedure.

## Native file integration

Native file open/save integration uses narrowly scoped Tauri permissions rather than broad filesystem access. Browser builds retain their download/upload behavior as a fallback.

Native operations include:

- open `.omi` and `.omi.json` manuscripts;
- save manuscripts through the platform-native file/document picker;
- import DOCX through the native file picker;
- export the formats supported by the current platform to a user-selected destination.

Desktop installations can additionally work with normal filesystem paths such as locally synchronized cloud folders, NAS mounts and external drives. Android uses document-provider access and iOS/iPadOS uses the Files document-provider layer instead of desktop-style folder paths.

## Mobile authentication

The native clients use bearer-session transport to the Studio API and external identity providers open through the platform in-app browser. ORCID, Google, Microsoft and configured institutional OIDC providers return through the shared native handoff. One-time handoff codes are exchanged for the native Studio session; provider credentials are never placed in the return URL.

## iPad layout

iPadOS uses the responsive Studio application rather than a separate tablet product. The app declares portrait and landscape orientations, allows indirect input devices such as keyboard/trackpad input, and does not require full-screen presentation, enabling iPad multitasking where supported by the operating system.

## iOS GitHub Actions build

The manual **iOS and iPadOS Build** workflow runs on a macOS GitHub runner and offers two modes:

- `simulator` — generates the Apple project and builds an Apple Silicon simulator application;
- `app-store-connect` — builds a signed App Store Connect IPA.

The workflow requires `APPLE_DEVELOPMENT_TEAM`. The signed IPA path additionally requires these GitHub secrets:

```text
IOS_CERTIFICATE
IOS_CERTIFICATE_PASSWORD
IOS_MOBILE_PROVISION
```

Certificates and provisioning profiles are never committed to the repository.

## Versioning

Keep these versions conceptually separate:

- Studio application version: distributed software release
- platform store/build number: Apple/Google packaging requirement
- OMI schema/model version: portable document contract

A Studio release may change without changing the OMI schema. An OMI schema change must have an explicit migration path.
