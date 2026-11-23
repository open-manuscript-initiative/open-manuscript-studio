> **Historical — deprecated 2026-11-23.** The EuroOffice editor was removed from Studio's Android and web applications. Do not use these previous integration instructions for current deployments. See [ADR-032](architecture/adr-032-office-service-separation.md).

# Android EuroOffice native embedding and failure recovery

The installed Tauri Android app uses a **sandboxed, unprivileged remote host** for EuroOffice. The Studio web app loads DocsAPI in the normal web page. These are distinct paths: a successful mobile browser test is not sufficient native evidence.

## Startup contract

1. The authenticated native frontend requests a short-lived editor session from the selected Studio API using its native bearer credential.
2. A server-hosted iframe performs the exact-source, opaque-origin, random-channel handshake. **Do not** pass this credential or the signed Office launch through a URL.
3. The host loads the configured HTTPS DocsAPI script and invokes `DocsAPI.DocEditor`; the synchronous constructor return is **not** success.
4. `onAppReady` means the app frame loaded. Only `onDocumentReady` means the document is ready for editing. `onError` reports a numeric code only, not its potentially sensitive description. A bounded timeout covers a hung initialization.
5. If the editor fails, Android offers to open the selected institutional Studio site in the browser. This does not transfer native tokens or open a private document via an unverified link; the user signs into the browser and navigates to their DOCX document.

## Android loading state and known sandbox limitation

When the native editor does not become ready, Studio now distinguishes session preparation, connection to the isolated host, startup of the Office editor, and loading the document. Session API requests have a separate 30-second cancellation limit; the iframe/document readiness watchdog remains 60 seconds. The browser recovery action is visible **during loading**, not only after the error timeout. It opens only the already-selected Studio server's web home page and sends no document token or manuscript data.

The native iframe and the HTTP host CSP deliberately enforce an **opaque origin**, without `allow-same-origin`. This is ADR-030's security boundary: remote Office JavaScript must not acquire Studio API-origin storage/cookie authority. A real ONLYOFFICE editor may require its nested frame to retain its own origin, so the synthetic tests cannot demonstrate native Android compatibility in every deployment. **Do not add `allow-same-origin` on the existing API-origin host as a quick fix.** Investigate a dedicated cookieless Office host origin or an independent, unprivileged native editor view, then validate its cross-origin handshake and capability boundaries.

If the UI remains on `Preparing EuroOffice session…`, first check the selected server API authentication/network request for the session. If it remains on `Connecting to EuroOffice…`, check whether the token-free embed-host frame loaded, CSP `frame-ancestors` matched the native origin, and any reverse proxy added `X-Frame-Options`. If it progresses to `Starting EuroOffice editor…`, inspect the Office API script, nested iframe and the sandbox/origin restrictions. If it reaches `Loading document…`, check the document server's real `onDocumentReady` and `onError` events, callback reachability, and any edition-specific mobile restrictions.

## Native Android desktop-mode retry (2026-11-22)

The loading screen shown as **"Starting EuroOffice editor…"** means that the
isolated host has loaded DocsAPI and answered the ready/launch handshake, but
ONLYOFFICE has **not** yet raised `onAppReady`. It is not the Studio account
sign-in screen. A separate mode/edition issue or the existing native iframe
sandbox restrictions may block the nested Office application.

ONLYOFFICE Docs documents its touch-optimized `type: "mobile"` editor as a
feature of **Enterprise/Developer** editions. For Community Edition deployments,
the native loading/error screen now offers **Try desktop editor**. This action:

1. requests a fresh `type=desktop` document session from the same selected
   Studio server with the existing native bearer authentication;
2. receives a **new server-signed DocsAPI JWT** (the client never edits the
   signed configuration or appends a token to a URL);
3. mounts a fresh isolated editor iframe using the existing strict CSP, sandbox,
   random postMessage channel and verified message source.

No separate browser sign-in or downgrade of the main Tauri CSP is involved.
This is a user-initiated compatibility attempt, **not a claim** that Community
Edition's desktop UI is officially supported in Android WebView. If the actual
ONLYOFFICE document editor requires a non-opaque host origin, both editor types
may still fail. In that case the long-term solution is a dedicated, cookieless
Office embedding origin with reviewed parent-message and content security
boundaries, **not** enabling `allow-same-origin` for the existing Studio API
origin.

The **Open in mobile browser** recovery action stays available. Test the
desktop retry and normal mobile editor on a real signed Android release with
the actual EuroOffice container. Confirm edit/save/close/reopen with a fresh
DOCX; a synthetic Chromium test is not enough to sign off compatibility.

## Evidence to collect

- Run `npx playwright test e2e/eurooffice-frame.mobile.spec.ts --project=mobile-chrome --retries=0`. This is synthetic browser coverage of the native branch and its error protocol; **it is not a physical Android WebView acceptance test**.
- On a device with a newly signed and installed APK/AAB, try both a newly created DOCX and an existing one, then check editing, saving, closing and reopening. Confirm the browser route also works for the **same selected server**.
- Check Android WebView Console/Logcat and network failures for the chosen Studio API `/api/v1/eurooffice/embed-host`, the configured Office `/web-apps/apps/api/documents/api.js`, editor iframe, WebSocket and callback endpoints. Do not paste JWTs, signed URLs, cookies, manuscript contents or full payloads into tickets.
- Android WebView blocks third-party cookies by default on modern targets. Unlike the browser's `studio.example.org` top-level origin, the native top level is `tauri.localhost`. Record whether the actual Office deployment requires third-party cookies; **do not globally enable them or remove CSP/sandbox as an unverified workaround**.
- Verify Android WebView version, server CSP `frame-ancestors` and absence of proxy-injected `X-Frame-Options`. The server deliberately removes its own framing restrictions on the token-free embed host, but a reverse proxy can re-add headers.
- The Docs mobile UI may depend on the deployed Office edition: confirm the actual vendor/distribution's mobile WebView support before changing client security policy.

## Rollout

Deploy the matching Studio API before distributing a rebuilt native app. Installing new web assets alone does not update an installed Android frontend. The safe browser fallback is deliberately separate authentication. Keep the change in draft until full CI, a physical Android run, and a real create/edit/save/reopen roundtrip pass.
