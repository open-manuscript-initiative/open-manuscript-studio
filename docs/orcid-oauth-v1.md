# ORCID OpenID Connect v1

Open Manuscript Studio authenticates ORCID iDs through the ORCID OpenID Connect authorization-code flow. Local e-mail/password authentication remains available as a fallback.

## Scope

The integration supports:

- provider discovery and live connection state;
- ORCID authorization with the `openid` scope;
- cryptographically random OAuth `state` and OpenID Connect `nonce` values;
- server-side authorization-code exchange;
- signed `id_token` validation against ORCID's discovered JWKS;
- issuer, audience, expiry and nonce validation;
- linking a verified ORCID iD to an existing Studio account;
- ORCID sign-in for an already linked account;
- assignment invitations through ORCID;
- displaying and disconnecting the linked ORCID iD in **Integrations → ORCID**;
- normal ORCID accounts and accounts protected by ORCID two-factor authentication;
- native-session handoff for installed Tauri applications;
- system-browser authentication and deep-link return on Android and iOS;
- explicit Sandbox/production network selection with fail-closed configuration validation.

ORCID performs password and 2FA verification on its own site. Studio never receives the ORCID password or second-factor secret.

## Endpoints

- `GET /api/auth/providers`
- `GET /api/auth/orcid/start`
- `GET /api/auth/orcid/start?mode=link`
- `GET /api/auth/orcid/start?mode=invite&invite=<token>`
- `GET /api/auth/orcid/callback`
- `POST /api/auth/orcid/native/exchange`
- `DELETE /api/auth/orcid/link`

`GET /api/auth/providers` reports whether ORCID is configured and whether the current authenticated Studio account has a linked ORCID identity. `DELETE /api/auth/orcid/link` removes the current account's ORCID identity link while leaving the local Studio account and password login intact.

## OpenID Connect security

The authorization request uses `scope=openid` and sends both `state` and `nonce`. State and nonce are generated from cryptographically secure random bytes. Only SHA-256 digests are persisted in the short-lived OAuth state record.

The callback exchanges the authorization code on the server and requires an `id_token`. Studio obtains ORCID's OpenID Provider metadata from `/.well-known/openid-configuration`, loads the advertised JWKS, and verifies the ID token signature and standard claims with JOSE. The token must have the expected ORCID issuer, the configured Studio client ID as audience, a valid lifetime, and the nonce originally generated for that authentication attempt.

If the token exposes an `amr` authentication-method reference, Studio stores it as identity metadata. ORCID documents that member integrations can use this information to determine whether two-factor authentication was used. The integration itself does not require or bypass 2FA; it delegates the complete authentication ceremony to ORCID.

## Account and identity binding

The ORCID identity key is the tuple `(provider, issuer, subject)`. This means Sandbox and production identities are cryptographically and logically separate even if the textual ORCID iD happens to be the same.

For an already linked identity, subsequent ORCID sign-ins resolve the existing `UserIdentity` row and therefore return to the same Studio account; they do not create another user. During linking and invitation acceptance, Studio checks whether the authenticated ORCID identity is already owned by a different Studio account and rejects the operation if so.

The first version intentionally does not create an arbitrary new Studio account solely from an unknown ORCID iD. The identity must first be linked to an existing Studio account or associated through a supported invitation flow. This prevents accidental duplicate accounts and prevents possession of an unrelated ORCID account from claiming an existing Studio profile.

## Installed application session handoff

Installed Windows, macOS, Linux, Android and iOS builds use the same hosted ORCID client and the same HTTPS callback as the web application. The ORCID client secret remains exclusively on the Studio server and is never compiled into a desktop or mobile application.

Desktop Tauri clients may use one of these exact local application return origins:

- `http://tauri.localhost`;
- `https://tauri.localhost`;
- `tauri://localhost`.

Android and iOS do not navigate the application WebView away from the bundled Studio UI for ORCID authentication. The app opens the ORCID authorization URL in the system browser and requests the exact registered mobile return target `openmanuscript://auth`. Tauri registers the `openmanuscript` custom URI scheme for mobile builds and delivers the return URL to the running app, or exposes it on cold start.

After ORCID authentication succeeds, the server does **not** place a Studio session token in a redirect URL. Instead it creates a random, two-minute, single-use handoff code and stores only its SHA-256 digest. Desktop flows return the code to the validated local Tauri origin; mobile flows return it through `openmanuscript://auth`. The handoff code is carried in the URL fragment rather than the query string.

The bundled frontend then calls `POST /api/auth/orcid/native/exchange` with the one-time code and the native-client header. The server atomically consumes the handoff, creates the normal native Studio session, and returns the native bearer token. The client persists that token in the same native session storage already used by e-mail/password login.

The server accepts only the exact native return targets listed above, including the exact `openmanuscript://auth` mobile target, so caller-controlled return URLs cannot be used as an open redirect.

## Integrations panel

The **Integrations → ORCID** card distinguishes these states:

- **Not configured** — server-side ORCID client credentials are missing;
- **Available** — ORCID OpenID Connect is configured, but this Studio account has no linked ORCID iD;
- **Connected** — the signed-in Studio account has a linked ORCID identity.

The **Connect ORCID** action starts the linking flow. Once connected, the card displays the verified ORCID iD and offers **Disconnect ORCID**.

## Environment selection

Use `ORCID_ENVIRONMENT` as the authoritative network selector:

```dotenv
ORCID_ENVIRONMENT=sandbox
```

or:

```dotenv
ORCID_ENVIRONMENT=production
```

The server maps these values internally:

| Environment | ORCID base URL / issuer |
| --- | --- |
| `sandbox` | `https://sandbox.orcid.org` |
| `production` | `https://orcid.org` |

`ORCID_BASE_URL` remains accepted only as a backward-compatible migration option. If both `ORCID_ENVIRONMENT` and `ORCID_BASE_URL` are present, they must identify the same ORCID network or server startup fails. Unknown ORCID base URLs are rejected.

Sandbox is the safe default when neither value is set, so a deployment cannot move to production ORCID accidentally merely because code was upgraded.

The server also rejects a partial credential pair: `ORCID_CLIENT_ID` and `ORCID_CLIENT_SECRET` must either both be configured or both be absent. When `NODE_ENV=production`, an explicitly configured `ORCID_REDIRECT_URI` must use HTTPS and must use the same origin as `FRONTEND_ORIGIN`. The callback route is served by the Studio API, so pointing the redirect at a different website host would return a 404 and would also separate the authentication callback from the Studio session cookie.

## ORCID Sandbox client registration

Test in the ORCID Sandbox before production. Register an ORCID Sandbox application with:

**Name**

```text
Open Manuscript Studio
```

**Application URL**

```text
https://studio.openmanuscript.org/
```

**Redirect URI**

```text
https://studio.openmanuscript.org/api/auth/orcid/callback
```

The callback URI registered at ORCID and `ORCID_REDIRECT_URI` must be identical. The mobile `openmanuscript://auth` URI is an application return target after the hosted callback; it is not registered as the ORCID OAuth callback and therefore does not expose the ORCID client secret to the app.

## Sandbox server configuration

```dotenv
FRONTEND_ORIGIN=https://studio.openmanuscript.org
ORCID_ENVIRONMENT=sandbox
ORCID_CLIENT_ID=APP-REPLACE_WITH_SANDBOX_CLIENT_ID
ORCID_CLIENT_SECRET=REPLACE_WITH_SANDBOX_CLIENT_SECRET
ORCID_REDIRECT_URI=https://studio.openmanuscript.org/api/auth/orcid/callback
```

Install the updated server dependencies and restart the API:

```bash
cd server
npm install
npm run build
sudo systemctl restart omi-studio-api.service
sudo systemctl status omi-studio-api.service --no-pager
```

Then verify provider discovery:

```bash
curl -sS https://studio.openmanuscript.org/api/auth/providers
```

## End-to-end test, including 2FA

1. Create or use an ORCID Sandbox account and enable two-factor authentication on it.
2. Sign in to Studio with an existing local account.
3. Open **Integrations → ORCID** and choose **Connect ORCID**.
4. Complete the ORCID password and two-factor authentication screens on `sandbox.orcid.org`.
5. Approve the authorization request.
6. Confirm that ORCID returns to `/api/auth/orcid/callback` on the Studio host and the card shows **Connected** with the verified ORCID iD.
7. Sign out of Studio and use **Sign in with ORCID**.
8. Complete ORCID 2FA again if ORCID requests it and confirm that Studio creates the normal authenticated session for the same account.
9. Repeat ORCID sign-in and verify that no second Studio user is created.
10. Attempt to link the same Sandbox ORCID identity to another Studio account and confirm that the link is rejected.
11. Confirm that e-mail/password login still works.
12. Test **Disconnect ORCID** and confirm that only the external identity link is removed.
13. Repeat the ORCID sign-in in an installed desktop application and confirm that the native bearer session is created and persists after restart.
14. On Android, tap **Sign in with ORCID** and confirm that the system browser opens the ORCID authorization page.
15. Complete authentication and confirm that `openmanuscript://auth` returns to the installed Studio app and that the user is signed in without seeing the web login page.
16. Repeat the mobile return test with the app already running and with the app fully closed before the browser returns.
17. Repeat the mobile test on iOS when a release build is available.

## Database

No new database migration is required for this production-readiness update. The existing `OAuthLoginState.returnPath` field carries the short-lived hashed nonce marker and the validated native return-target marker for an authentication attempt; no raw nonce is persisted. The same short-lived table is reused for native handoff records, storing only the SHA-256 digest of the two-minute, single-use handoff code. `UserIdentity.profile` records the protocol, granted scope, and available authentication-method metadata.

## Production cutover

Production ORCID requires its own production client credentials. Do not reuse Sandbox credentials.

For the hosted Open Manuscript Studio deployment, register/configure the production ORCID application with the callback:

```text
https://studio.openmanuscript.org/api/auth/orcid/callback
```

Then change the server configuration to:

```dotenv
NODE_ENV=production
FRONTEND_ORIGIN=https://studio.openmanuscript.org
DEPLOYMENT_MODE=personal
ORCID_ENVIRONMENT=production
ORCID_CLIENT_ID=APP-REPLACE_WITH_PRODUCTION_CLIENT_ID
ORCID_CLIENT_SECRET=REPLACE_WITH_PRODUCTION_CLIENT_SECRET
ORCID_REDIRECT_URI=https://studio.openmanuscript.org/api/auth/orcid/callback
```

Remove an old `ORCID_BASE_URL=https://sandbox.orcid.org` line when switching, or replace it with the production value. Prefer removing `ORCID_BASE_URL` entirely and letting `ORCID_ENVIRONMENT` select the endpoint.

Before restart, verify that no `VITE_ORCID_*` variable contains the client secret. The secret belongs only in server-side configuration. The production callback origin guard will reject a callback such as `https://openmanuscript.org/api/auth/orcid/callback` when `FRONTEND_ORIGIN=https://studio.openmanuscript.org`, preventing a cross-host callback failure.

Then rebuild and restart the API and check `/api/auth/providers` before performing the first production login.

Keep the client secret exclusively in server-side configuration and never expose it through a `VITE_*` variable, browser storage, screenshots, committed `.env` files, or public documentation.
