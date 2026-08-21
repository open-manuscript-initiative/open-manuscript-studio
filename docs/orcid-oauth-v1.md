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
- explicit Sandbox/production network selection with fail-closed configuration validation.

ORCID performs password and 2FA verification on its own site. Studio never receives the ORCID password or second-factor secret.

## Endpoints

- `GET /api/auth/providers`
- `GET /api/auth/orcid/start`
- `GET /api/auth/orcid/start?mode=link`
- `GET /api/auth/orcid/start?mode=invite&invite=<token>`
- `GET /api/auth/orcid/callback`
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

The server also rejects a partial credential pair: `ORCID_CLIENT_ID` and `ORCID_CLIENT_SECRET` must either both be configured or both be absent. When `NODE_ENV=production`, an explicitly configured `ORCID_REDIRECT_URI` must use HTTPS.

## ORCID Sandbox client registration

Test in the ORCID Sandbox before production. Register an ORCID Sandbox application with:

**Name**

```text
Open Manuscript Studio
```

**Application URL**

```text
https://openmanuscript.org/
```

**Redirect URI**

```text
https://openmanuscript.org/api/auth/orcid/callback
```

The callback URI registered at ORCID and `ORCID_REDIRECT_URI` must be identical.

## Sandbox server configuration

```dotenv
ORCID_ENVIRONMENT=sandbox
ORCID_CLIENT_ID=APP-REPLACE_WITH_SANDBOX_CLIENT_ID
ORCID_CLIENT_SECRET=REPLACE_WITH_SANDBOX_CLIENT_SECRET
ORCID_REDIRECT_URI=https://openmanuscript.org/api/auth/orcid/callback
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
curl -sS https://openmanuscript.org/api/auth/providers
```

## End-to-end test, including 2FA

1. Create or use an ORCID Sandbox account and enable two-factor authentication on it.
2. Sign in to Studio with an existing local account.
3. Open **Integrations → ORCID** and choose **Connect ORCID**.
4. Complete the ORCID password and two-factor authentication screens on `sandbox.orcid.org`.
5. Approve the authorization request.
6. Confirm that ORCID returns to `/api/auth/orcid/callback` and the card shows **Connected** with the verified ORCID iD.
7. Sign out of Studio and use **Sign in with ORCID**.
8. Complete ORCID 2FA again if ORCID requests it and confirm that Studio creates the normal authenticated session for the same account.
9. Repeat ORCID sign-in and verify that no second Studio user is created.
10. Attempt to link the same Sandbox ORCID identity to another Studio account and confirm that the link is rejected.
11. Confirm that e-mail/password login still works.
12. Test **Disconnect ORCID** and confirm that only the external identity link is removed.

## Database

No new database migration is required for this production-readiness update. The existing `OAuthLoginState.returnPath` field carries the short-lived hashed nonce marker for an authentication attempt; no raw nonce is persisted. `UserIdentity.profile` records the protocol, granted scope, and available authentication-method metadata.

## Production cutover

Production ORCID requires its own production client credentials. Do not reuse Sandbox credentials.

Register/configure the production ORCID application with the callback:

```text
https://openmanuscript.org/api/auth/orcid/callback
```

Then change the server configuration to:

```dotenv
ORCID_ENVIRONMENT=production
ORCID_CLIENT_ID=APP-REPLACE_WITH_PRODUCTION_CLIENT_ID
ORCID_CLIENT_SECRET=REPLACE_WITH_PRODUCTION_CLIENT_SECRET
ORCID_REDIRECT_URI=https://openmanuscript.org/api/auth/orcid/callback
```

Remove an old `ORCID_BASE_URL=https://sandbox.orcid.org` line when switching, or replace it with the production value. Prefer removing `ORCID_BASE_URL` entirely and letting `ORCID_ENVIRONMENT` select the endpoint.

Before restart, verify that no `VITE_ORCID_*` variable contains the client secret. The secret belongs only in server-side configuration. Then rebuild and restart the API and check `/api/auth/providers` before performing the first production login.

Keep the client secret exclusively in server-side configuration and never expose it through a `VITE_*` variable, browser storage, screenshots, committed `.env` files, or public documentation.
