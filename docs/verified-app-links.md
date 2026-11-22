# Verified native app links

Open Manuscript Studio uses a verified HTTPS app link for the mobile ORCID return flow:

`https://app.openmanuscript.org/auth/orcid`

The ORCID OAuth/OIDC callback itself remains server-side at:

`https://studio.openmanuscript.org/api/auth/orcid/callback`

After ORCID authentication succeeds, the Studio API creates a short-lived, single-use native handoff code and redirects the system browser to the verified app-link URL. The handoff code is kept in the URL fragment and is never used as the ORCID client secret or as a Studio session token.

## Android

The Tauri application declares `https://app.openmanuscript.org/auth/orcid` as an Android App Link. Production deployment publishes `/.well-known/assetlinks.json` on `app.openmanuscript.org`. The file contains both certificates that can sign an installed production build:

- the release certificate used for packages distributed directly by GitHub Actions;
- the Google Play App Signing certificate used when Google Play re-signs the uploaded Android bundle.

The Google Play upload key is not the installed application's signing identity and must not be substituted for the Play App Signing certificate. Certificate fingerprints are public association data; private signing keys and passwords remain GitHub/Google secrets.

If the signed OMI Studio application is installed and Android has verified the domain association, the HTTPS return opens the installed application directly. The application exchanges the one-time handoff code for its native bearer session.

If the application is not installed, the same HTTPS URL opens a small fallback page that offers installation, the web Studio, and a direct `openmanuscript://auth` custom-scheme fallback button. The custom scheme remains registered as a recovery path when a device has not yet refreshed App Link verification, including Android/Chrome variants that do not reliably dispatch hand-authored `intent://` URLs.

The public verification file must be available without redirects at:

`https://app.openmanuscript.org/.well-known/assetlinks.json`

## Stable App Links across Android releases

The Play Console deep-link inventory is **version-specific**, but a new Android
`versionCode` does **not** require editing the Play Console link configuration,
re-registering this HTTPS domain or changing the Digital Asset Links certificate.
The `org.openmanuscript.studio` package identity, ORCID HTTPS return route and
Play App Signing SHA-256 fingerprint stay the same across regular releases.

Production CI protects `/.well-known/assetlinks.json` from the web deployment's
`rsync --delete`. It constructs a new association file next to the destination
and atomically replaces the public file **only when its content actually changes**.
Unrelated server releases therefore cannot temporarily remove the verification
file. Keep both the direct-APK release certificate and the Google Play **app
signing** certificate in this association; the Play upload certificate alone
does not authorize the APK users install from Google Play.

Every Android Release workflow verifies the **built AAB**, including:

- the `https://app.openmanuscript.org/auth/orcid` HTTPS intent filter,
  `android:autoVerify="true"` and the ORCID route prefix;
- the independent `openmanuscript://` custom-scheme fallback filter;
- the correct package, versionCode and absence of forbidden install permissions.

When `publish_to_play` is enabled, the workflow also fetches the **live**
`assetlinks.json` over HTTPS before uploading to Play and checks that the
Google Play App Signing certificate is authorized. A broken public association
blocks the upload instead of requiring a later manual Play Console fix.

The Play Console recommendation to convert custom-scheme URLs to HTTPS is
advisory for the existing `openmanuscript://auth` compatibility fallback.
Do not remove that fallback merely to eliminate the recommendation: it is
used when an Android device has not verified the HTTPS association. Only
register new HTTPS routes when the server can safely serve and handle them.
The OAuth provider callback itself must continue using the existing
server-side endpoint, not the app's custom scheme.

### Release diagnostics

After a Play build is installed on a test device:

```sh
adb shell pm get-app-links org.openmanuscript.studio
adb shell am start -a android.intent.action.VIEW -d 'https://app.openmanuscript.org/auth/orcid'
```

Check that the domain is verified and the Studio app receives the link.
For a complete sign-in test, use an actual ORCID login with a fresh,
single-use handoff code, both when the app is already running and on cold start.
Do not use a fabricated authentication code to judge whether login works.

Certificate **rotation** (not ordinary version increments) requires updating
the association and testing the old/new signing identities. Android 14 and
older do not periodically re-verify domain associations in the background;
existing devices may need explicit re-verification after an actual key/domain
change. The HTTPS association must still be served without redirects.

## iOS

The Tauri configuration uses the same HTTPS app-link declaration for mobile builds. Full iOS Universal Link activation additionally requires an `apple-app-site-association` file containing the Apple Team ID and bundle identifier. That file should be added when the iOS signing identity is finalized.

## Security properties

- ORCID client credentials remain exclusively on the Studio server.
- The app-link contains only a short-lived, single-use handoff code.
- Only explicit Studio native return targets are accepted by the API.
- The Android domain association is bound to `org.openmanuscript.studio` and every certificate authorized to sign a distributed production build.
- The fallback website never receives the URL fragment in the HTTP request.
