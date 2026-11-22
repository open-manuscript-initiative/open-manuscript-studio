# Android EuroOffice native embedding and failure recovery

The installed Tauri Android app uses a **sandboxed, unprivileged remote host** for EuroOffice. The Studio web app loads DocsAPI in the normal web page. These are distinct paths: a successful mobile browser test is not sufficient native evidence.

## Startup contract

1. The authenticated native frontend requests a short-lived editor session from the selected Studio API using its native bearer credential.
2. A server-hosted iframe performs the exact-source, opaque-origin, random-channel handshake. **Do not** pass this credential or the signed Office launch through a URL.
3. The host loads the configured HTTPS DocsAPI script and invokes `DocsAPI.DocEditor`; the synchronous constructor return is **not** success.
4. `onAppReady` means the app frame loaded. Only `onDocumentReady` means the document is ready for editing. `onError` reports a numeric code only, not its potentially sensitive description. A bounded timeout covers a hung initialization.
5. If the editor fails, Android offers to open the selected institutional Studio site in the browser. This does not transfer native tokens or open a private document via an unverified link; the user signs into the browser and navigates to their DOCX document.

## Evidence to collect

- Run `npx playwright test e2e/eurooffice-frame.mobile.spec.ts --project=mobile-chrome --retries=0`. This is synthetic browser coverage of the native branch and its error protocol; **it is not a physical Android WebView acceptance test**.
- On a device with a newly signed and installed APK/AAB, try both a newly created DOCX and an existing one, then check editing, saving, closing and reopening. Confirm the browser route also works for the **same selected server**.
- Check Android WebView Console/Logcat and network failures for the chosen Studio API `/api/v1/eurooffice/embed-host`, the configured Office `/web-apps/apps/api/documents/api.js`, editor iframe, WebSocket and callback endpoints. Do not paste JWTs, signed URLs, cookies, manuscript contents or full payloads into tickets.
- Android WebView blocks third-party cookies by default on modern targets. Unlike the browser's `studio.example.org` top-level origin, the native top level is `tauri.localhost`. Record whether the actual Office deployment requires third-party cookies; **do not globally enable them or remove CSP/sandbox as an unverified workaround**.
- Verify Android WebView version, server CSP `frame-ancestors` and absence of proxy-injected `X-Frame-Options`. The server deliberately removes its own framing restrictions on the token-free embed host, but a reverse proxy can re-add headers.
- The Docs mobile UI may depend on the deployed Office edition: confirm the actual vendor/distribution's mobile WebView support before changing client security policy.

## Rollout

Deploy the matching Studio API before distributing a rebuilt native app. Installing new web assets alone does not update an installed Android frontend. The safe browser fallback is deliberately separate authentication. Keep the change in draft until full CI, a physical Android run, and a real create/edit/save/reopen roundtrip pass.
