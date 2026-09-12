# Android release signing and Google Play testing

Open Manuscript Studio Android releases are built as signed Android App Bundles (`.aab`) for Google Play and signed universal APKs (`.apk`) for direct testing or distribution.

The GitHub Actions workflow is `.github/workflows/android-release.yml`.

## 1. Create the upload keystore

Create this key once and preserve it securely. Do not commit the keystore or its passwords to Git.

On Windows PowerShell with JDK 21 installed:

```powershell
keytool -genkeypair `
  -v `
  -keystore "$env:USERPROFILE\open-manuscript-upload.jks" `
  -storetype JKS `
  -keyalg RSA `
  -keysize 2048 `
  -validity 10000 `
  -alias upload
```

The recommended alias is `upload`.

Keep an offline backup of the keystore and its passwords. The upload key is part of the application's release identity and is needed for future updates.

## 2. Encode the keystore for GitHub Actions

PowerShell:

```powershell
$bytes = [System.IO.File]::ReadAllBytes("$env:USERPROFILE\open-manuscript-upload.jks")
[Convert]::ToBase64String($bytes) | Set-Content -NoNewline "$env:USERPROFILE\open-manuscript-upload.base64.txt"
```

Copy the contents of `open-manuscript-upload.base64.txt` into the GitHub secret described below.

## 3. Add repository secrets

In GitHub, open:

`Settings -> Secrets and variables -> Actions -> New repository secret`

Create these secrets:

- `ANDROID_KEYSTORE_BASE64` — complete Base64 content of the upload keystore.
- `ANDROID_KEY_ALIAS` — normally `upload`.
- `ANDROID_KEYSTORE_PASSWORD` — keystore password.
- `ANDROID_KEY_PASSWORD` — key password. This is optional; when omitted, the workflow uses `ANDROID_KEYSTORE_PASSWORD`.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` — complete JSON credential for the Google Play Developer API service account. This is only required for automated Play uploads.

Never place any of these values in source files, workflow YAML, issues, pull requests, or build logs.

## 4. Build a signed release in GitHub

Open:

`Actions -> Android Release -> Run workflow`

For the first test, leave **Upload the signed AAB to Google Play after building** disabled.

The workflow will:

1. install Node.js 24 and JDK 17;
2. install the Android SDK/NDK and Rust Android targets;
3. regenerate the Tauri Android project;
4. configure release signing from GitHub Secrets;
5. build a signed AAB;
6. build a signed universal APK;
7. store both as the `open-manuscript-studio-android-signed` workflow artifact.

The generated native project and all signing material remain outside version control.

## 5. First Google Play upload

The first release for package `org.openmanuscript.studio` must be created in Google Play Console before API-based publishing is used.

Create the Open Manuscript Studio application in Play Console, enable Play App Signing, create an **Internal testing** release, and manually upload the signed AAB produced by the workflow.

Google Play records the package identifier and upload certificate during this initial setup. Once this application/release foundation exists, subsequent testing releases can use the automated upload path described below.

## 6. Configure automated Play uploads

After the application exists in Play Console:

1. enable the Google Play Android Developer API for the Google Cloud project used by the Play Console integration;
2. create a dedicated service account;
3. grant it only the Play Console permissions required to create testing releases;
4. store the service-account JSON as `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` in GitHub Actions secrets.

Then run the **Android Release** workflow with Play upload enabled and select a track:

- `internal` — recommended for initial automated testing;
- `alpha` — closed/alpha testing where configured;
- `beta` — beta testing where configured.

The workflow intentionally does not publish directly to the production track.

## 7. Direct APK distribution

The workflow also produces a signed universal APK. It can be used for direct installation outside Google Play while preserving a stable signing identity across releases.

Google Play Protect may still show a reputation warning for directly downloaded APKs, especially while the application is new or rarely installed. Store distribution and accumulated signing/reputation history normally reduce this friction.

## Security rules

- Never regenerate the upload key for routine releases.
- Keep at least one encrypted offline backup of the keystore and recovery information.
- Use GitHub Secrets only for CI credentials.
- Do not commit `src-tauri/gen/`, `*.jks`, `*.keystore`, or `keystore.properties`.
- Keep Google Play Console access and service-account permissions minimal.
- Use Play App Signing for Play-distributed builds.

## Play and direct-download update channels

Use `npm run android:build:play` for the signed Play AAB and
`npm run android:build:direct` for the signed direct-download APK, after Android
initialization and signing setup. The Android Release workflow runs both.

The Play command temporarily adds a release manifest overlay that removes
`REQUEST_INSTALL_PACKAGES` and the updater FileProvider. It builds the frontend
with `VITE_ANDROID_DISTRIBUTION=play`, so update actions open the app's Play listing,
including stale APK update actions. The native installer also refuses requests
when the installation permission is absent. The overlay is removed after the
build, including on failure, so the subsequent direct APK retains its updater.
An existing developer-owned release manifest is never overwritten.

CI uses bundletool to inspect every module's manifest in the finished AAB, and
checks the package identifier and versionCode before any Play upload. A failed
check blocks publication. The direct APK is not a Play upload artifact.

The beta.8 Play rebuild uses Android versionCode **1009** (previously 1008);
the displayed application version remains 0.1.0-beta.8. Increment versionCode
again for any later upload. Replace the previous bundle in the Play release
draft with this newly built AAB. If Play still requests a declaration, inspect
the version codes of other retained bundles and active testing releases too.

Update discovery still uses public release metadata; Play review or testing
track availability can lag behind it. The Play build always delegates installation
to Google Play and never downloads the GitHub APK.

References:
- [Google Play installation permission policy](https://support.google.com/googleplay/android-developer/answer/12085295)
- [Android bundletool](https://developer.android.com/tools/bundletool)
