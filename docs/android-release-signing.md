# Android release signing

Open Manuscript Studio Android release APKs are signed with a dedicated long-lived Android release key before they are published by GitHub Actions.

The private key must never be committed to this repository. GitHub-hosted pull-request builds remain debug-signed test builds; published builds from `main`, tags, or manual release runs require the release-signing secrets below.

## 1. Create the release keystore once

Run this on a trusted workstation and store the resulting keystore in at least two secure backup locations:

```powershell
keytool -genkeypair `
  -v `
  -keystore omi-android-release.jks `
  -alias omi-studio `
  -keyalg RSA `
  -keysize 4096 `
  -validity 10000
```

Use a strong unique keystore password and key password. Do not reuse normal account passwords.

The alias may be different, but the same alias and key must be retained for future direct APK updates.

## 2. Convert the keystore to Base64 for GitHub Actions

PowerShell:

```powershell
[Convert]::ToBase64String(
  [IO.File]::ReadAllBytes("$PWD\omi-android-release.jks")
) | Set-Content -NoNewline .\omi-android-release.base64.txt
```

The `.jks` and Base64 files are secrets. Do not commit either file.

## 3. Add GitHub Actions secrets

In the `open-manuscript-initiative/open-manuscript-studio` repository, add these repository Actions secrets:

- `ANDROID_KEYSTORE_BASE64` — complete contents of `omi-android-release.base64.txt`
- `ANDROID_KEYSTORE_PASSWORD` — keystore password
- `ANDROID_KEY_ALIAS` — for example `omi-studio`
- `ANDROID_KEY_PASSWORD` — private-key password

Repository path in GitHub:

`Settings → Secrets and variables → Actions → New repository secret`

## 4. CI behavior

The release workflow performs the following steps for non-PR builds:

1. decodes the keystore into the GitHub runner temporary directory;
2. validates the requested alias with `keytool`;
3. builds a non-debug Android APK;
4. signs the collected APK with Android SDK `apksigner`;
5. verifies the APK signature and prints the signer certificate information;
6. uploads only the verified signed APK to the release artifact set.

If any required Android signing secret is missing, a publishable build fails instead of silently releasing an unsigned/debug-signed APK.

Pull-request builds do not receive repository secrets and therefore continue to use debug APKs only for CI validation.

## 5. Key custody and rotation

For direct APK distribution, Android uses the signing key as part of application identity. Losing the private key can prevent users from upgrading an existing installation with future APKs signed by another key.

Therefore:

- keep encrypted offline backups of the keystore;
- restrict access to release maintainers;
- never upload the private keystore as a GitHub Release asset;
- never print passwords or Base64 key material in CI logs;
- record the public certificate fingerprint separately for release verification;
- do not rotate the direct-distribution signing key casually.

If Open Manuscript Studio is later distributed through Google Play, Play App Signing should be evaluated separately. The direct-download APK signing key and the Play upload/app-signing key strategy must be planned before the first production Play release.

## 6. Verify a downloaded release manually

With Android SDK Build Tools installed:

```powershell
apksigner verify --verbose --print-certs .\Open-Manuscript-Studio-Android-universal.apk
```

The signer certificate fingerprint should match the fingerprint recorded for the official OMI Android release key.
