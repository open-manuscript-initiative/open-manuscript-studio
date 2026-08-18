# ORCID OAuth v1

Open Manuscript Studio supports authenticated ORCID iDs through the ORCID OAuth 2.0 authorization-code flow.

## Scope of v1

The first version keeps the existing e-mail/password authentication and adds ORCID as a federated sign-in identity. It supports:

- discovering whether ORCID login is configured;
- starting an ORCID authorization request with the `/authenticate` scope;
- validating a single-use, time-limited OAuth `state` value;
- exchanging the authorization code on the server;
- linking a verified ORCID iD to an existing Studio account;
- showing the linked ORCID iD in the Studio Integrations panel;
- disconnecting a linked ORCID identity from the authenticated Studio account;
- signing in an account that already has a linked ORCID identity;
- accepting assignment invitations through ORCID;
- creating the normal Studio session cookie after successful ORCID authentication.

The browser never receives `ORCID_CLIENT_SECRET`.

## Endpoints

- `GET /api/auth/providers`
- `GET /api/auth/orcid/start`
- `GET /api/auth/orcid/start?mode=link`
- `GET /api/auth/orcid/start?mode=invite&invite=<token>`
- `GET /api/auth/orcid/callback`
- `DELETE /api/auth/orcid/link`

`GET /api/auth/providers` reports whether ORCID is configured and, for an authenticated Studio session, whether the current account already has an ORCID identity linked. `DELETE /api/auth/orcid/link` is authenticated and idempotent: it removes the current account's ORCID identity link and clears the matching legacy `users.orcid` value, while leaving the local Studio account and password login intact.

## Integrations panel

The **Integrations → ORCID** card is available when this version is deployed. It reads live provider state from `GET /api/auth/providers` and distinguishes these states:

- **Not configured** — server-side ORCID client credentials are missing;
- **Available** — ORCID OAuth is configured, but this Studio account has no linked ORCID iD;
- **Connected** — the signed-in Studio account has a linked ORCID identity.

The **Connect ORCID** action starts `GET /api/auth/orcid/start?mode=link`. Authentication and consent take place on ORCID, not inside Studio. When connected, the card displays the verified ORCID iD and exposes **Disconnect ORCID**, which calls `DELETE /api/auth/orcid/link`.

## ORCID Sandbox client registration

ORCID recommends testing Public API integrations in the Sandbox before production. Sign in to the ORCID Sandbox, open **Developer Tools**, accept the Public API terms if requested, and register a new Public API application.

Use these values for the Open Manuscript Studio test client:

**Name**

```text
Open Manuscript Studio
```

**Application URL**

```text
https://openmanuscript.org/
```

**Application description**

```text
Open Manuscript Studio is an open-source scholarly manuscript editing environment developed by the Open Manuscript Initiative. The ORCID integration allows researchers to authenticate their ORCID iD and link that verified identifier to their Studio account. The first version requests only the ORCID /authenticate scope and does not write data to ORCID records.
```

**Redirect URI**

```text
https://openmanuscript.org/api/auth/orcid/callback
```

Register the full callback path, not only the domain. ORCID requires redirect URI matching and production redirect URIs must use HTTPS.

After saving the application, ORCID displays a Client ID (normally beginning with `APP-`) and a Client Secret. The secret must be copied only to the server configuration; never place it in GitHub, frontend source code, a `VITE_*` variable, browser storage, screenshots, or public documentation.

## Sandbox server configuration

Add the generated Sandbox credentials to the environment used by `omi-studio-api.service`:

```dotenv
ORCID_CLIENT_ID=APP-REPLACE_WITH_SANDBOX_CLIENT_ID
ORCID_CLIENT_SECRET=REPLACE_WITH_SANDBOX_CLIENT_SECRET
ORCID_BASE_URL=https://sandbox.orcid.org
ORCID_REDIRECT_URI=https://openmanuscript.org/api/auth/orcid/callback
```

The callback URI registered at ORCID and `ORCID_REDIRECT_URI` must be identical.

Restart the API after changing the environment:

```bash
sudo systemctl restart omi-studio-api.service
sudo systemctl status omi-studio-api.service --no-pager
```

Then verify provider discovery:

```bash
curl -sS https://openmanuscript.org/api/auth/providers
```

The response should contain:

```json
{
  "providers": {
    "orcid": {
      "enabled": true,
      "label": "ORCID"
    }
  }
}
```

Additional properties may also be present.

## Sandbox end-to-end test

1. Create or use an ORCID Sandbox test record. Sandbox identities are separate from production ORCID records.
2. Open Open Manuscript Studio and sign in with an existing local Studio account.
3. Open **Integrations → ORCID** and choose **Connect ORCID**.
4. Authenticate against `sandbox.orcid.org` and approve the request.
5. Confirm that ORCID redirects to `https://openmanuscript.org/api/auth/orcid/callback` and the Integrations card shows **Connected** with the verified ORCID iD.
6. Sign out of Studio.
7. Choose **Sign in with ORCID** and confirm that Studio creates the normal authenticated session for the linked account.
8. Confirm that the account retains its e-mail/password login as a fallback.
9. Optionally sign in locally again, choose **Disconnect ORCID**, and confirm that the ORCID card returns to **Available** while the local account continues to work.

The first version intentionally does not create an arbitrary new Studio account solely from an unknown ORCID iD. An ORCID identity must be linked to an existing Studio account, or be associated through a supported invitation flow. This prevents accidental duplicate accounts.

## Database

The Prisma schema uses `UserIdentity` for federated identities and `OAuthLoginState` for short-lived authorization state. Apply the existing migrations before enabling ORCID authentication:

```bash
cd server
npm ci
npx prisma migrate deploy
npx prisma generate
```

## Production registration

After the Sandbox flow succeeds, register a separate Public API client in the production ORCID Registry. Use the same application identity:

**Name:** `Open Manuscript Studio`

**Application URL:** `https://openmanuscript.org/`

**Redirect URI:**

```text
https://openmanuscript.org/api/auth/orcid/callback
```

Production configuration:

```dotenv
ORCID_CLIENT_ID=APP-REPLACE_WITH_PRODUCTION_CLIENT_ID
ORCID_CLIENT_SECRET=REPLACE_WITH_PRODUCTION_CLIENT_SECRET
ORCID_BASE_URL=https://orcid.org
ORCID_REDIRECT_URI=https://openmanuscript.org/api/auth/orcid/callback
```

Do not reuse Sandbox credentials in production. Restart the API and repeat provider discovery and sign-in testing after switching environments.

## Security notes

OAuth `state` values are generated using cryptographically secure random bytes, stored only as SHA-256 hashes, expire after ten minutes, and are deleted when consumed. The ORCID authorization code is exchanged only by the server. Studio stores the authenticated ORCID identifier and identity metadata; v1 does not persist the returned ORCID access token.

For production, keep the API and callback behind HTTPS and never place the ORCID client secret in a `VITE_*` variable or frontend bundle.
