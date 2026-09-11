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

## iOS

The Tauri configuration uses the same HTTPS app-link declaration for mobile builds. Full iOS Universal Link activation additionally requires an `apple-app-site-association` file containing the Apple Team ID and bundle identifier. That file should be added when the iOS signing identity is finalized.

## Security properties

- ORCID client credentials remain exclusively on the Studio server.
- The app-link contains only a short-lived, single-use handoff code.
- Only explicit Studio native return targets are accepted by the API.
- The Android domain association is bound to `org.openmanuscript.studio` and every certificate authorized to sign a distributed production build.
- The fallback website never receives the URL fragment in the HTTP request.
