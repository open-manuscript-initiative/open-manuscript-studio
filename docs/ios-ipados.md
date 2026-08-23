# Open Manuscript Studio for iOS and iPadOS

Open Manuscript Studio uses the same React/TypeScript application core, OMI manuscript model and Tauri 2 native shell on iPhone and iPad as on the other supported platforms. iOS/iPadOS is not maintained as a separate application fork.

## Supported baseline

- Bundle identifier: `org.openmanuscript.studio`
- Minimum iOS/iPadOS version: 14.0
- Native shell: Tauri 2
- App Store short version: `0.1.0`
- Current alpha build number: `4`
- Public Studio development line: `0.1.0-alpha.4`

The numeric Apple short version is intentionally separated from the prerelease label because Apple bundle version fields require store-compatible version values. The Studio UI and release metadata can continue to identify the software as `0.1.0-alpha.4`.

## Development prerequisites

iOS development is available only on macOS. Install:

- current Xcode, not only the Command Line Tools;
- Node.js 24 or the repository-supported Node version;
- Rust stable;
- CocoaPods;
- the Rust iOS targets:

```bash
rustup target add aarch64-apple-ios x86_64-apple-ios aarch64-apple-ios-sim
```

An Apple Development Team ID is required by the generated Xcode project. Configure it for the current terminal, CI environment or Xcode account:

```bash
export APPLE_DEVELOPMENT_TEAM=YOUR_TEAM_ID
```

Do not commit certificates, provisioning profiles or App Store Connect keys to the repository.

## Initialize the generated Xcode project

The generated Apple project remains build output and is not the source of truth. Recreate it from the repository configuration when necessary:

```bash
npm ci
npm run ios:init
```

The generated project is written below `src-tauri/gen/apple/` or the Tauri iOS generation directory used by the installed CLI.

## Simulator development

Run on an Apple Silicon iOS/iPadOS simulator:

```bash
npm run ios:simulator
```

Build a simulator application without App Store distribution signing:

```bash
npm run ios:build:simulator
```

The responsive Studio interface is shared with Android, while iPad can make use of the larger viewport and all supported orientations. `UIRequiresFullScreen` is disabled so the application is compatible with iPad multitasking where the operating system permits it.

## Files and document storage

iOS/iPadOS uses the system Files / UIDocumentPicker surface rather than broad filesystem access.

Studio can open or save OMI manuscripts to locations exposed by Files, including, depending on device configuration:

- On My iPhone / On My iPad;
- iCloud Drive;
- connected external storage;
- third-party Files providers such as OneDrive, Google Drive, Dropbox or compatible provider applications.

The native picker returns security-scoped `file://` document URLs. Studio passes them directly to the Tauri filesystem plugin and does not expose them as meaningful filesystem paths in the user interface.

When opening an existing document, the dialog explicitly uses document-picker mode and security-scoped access. A normal own-device workflow can keep the selected document as the working target for the current Studio session. In shared-device mode the path is not retained as a normal working-file association.

## Mobile export surface

The iPhone/iPad export list intentionally matches the useful Android mobile surface:

- portable OMI package (`.omi.zip`)
- OMI JSON (`.omi.json`)
- JATS XML (`.xml`)
- semantic HTML package (`.html.zip`)
- DOCX (`.docx`)
- LaTeX (`.tex`)
- EPUB (`.epub`)

Desktop production formats that depend on desktop publishing workflows are hidden on iOS/iPadOS:

- IDML
- XTG
- MIF
- SLA
- browser print/PDF export

They remain available on desktop/web where appropriate.

## Authentication and return to the app

ORCID, Google, Microsoft and configured institutional OIDC authentication use the same native handoff mechanism as Android. Authentication opens in an in-app browser and returns a one-time `nativeAuthCode` to the Studio app.

The preferred production return is the verified HTTPS Universal Link:

```text
https://app.openmanuscript.org/auth/orcid/
```

The custom scheme remains registered as a fallback/development return target:

```text
openmanuscript://auth/
```

For production Universal Links, `app.openmanuscript.org` must serve:

```text
/.well-known/apple-app-site-association
```

The association must contain the real Apple Development Team ID together with the bundle identifier `org.openmanuscript.studio`. Do not publish a guessed Team ID. See the deployment section below.

## Apple Universal Link deployment

After the Apple Developer account and Team ID are available, publish an `apple-app-site-association` JSON document from `app.openmanuscript.org` with `Content-Type: application/json`, no redirect, and no filename extension.

Template:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "APPLE_TEAM_ID.org.openmanuscript.studio",
        "components": [
          { "/": "/auth/orcid" },
          { "/": "/auth/orcid/*" }
        ]
      }
    ]
  }
}
```

Replace `APPLE_TEAM_ID` with the actual Team ID. The HTTPS callback path is shared by the current native ORCID/OIDC handoff implementation even when the initiating provider was not ORCID.

## Signed device and App Store Connect build

iOS code signing requires Apple Developer enrollment and a registered App ID whose bundle identifier is exactly:

```text
org.openmanuscript.studio
```

For a manual App Store Connect signing workflow, configure GitHub secrets:

```text
APPLE_DEVELOPMENT_TEAM
IOS_CERTIFICATE
IOS_CERTIFICATE_PASSWORD
IOS_MOBILE_PROVISION
```

`IOS_CERTIFICATE` and `IOS_MOBILE_PROVISION` contain base64-encoded Apple Distribution certificate and App Store Connect provisioning-profile material as expected by Tauri.

Build locally:

```bash
npm run ios:build:app-store
```

The resulting IPA is generated below the Tauri Apple build directory, normally:

```text
src-tauri/gen/apple/build/arm64/Open Manuscript Studio.ipa
```

The repository also includes the manual **iOS and iPadOS Build** GitHub Actions workflow. It can build either a simulator artifact or a signed `app-store-connect` IPA after the Apple Team/signing secrets have been configured.

## App Store boundary

The repository implementation can prepare and build the iOS/iPadOS application, but public App Store/TestFlight distribution cannot be completed without the project owner's Apple Developer account, certificates/provisioning, App Store Connect application record, privacy declarations and review submission.

No Apple Team ID, signing certificate, provisioning profile or App Store API key should ever be invented or committed as source code.
