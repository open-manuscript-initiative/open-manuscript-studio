# ORCID OAuth v1

Open Manuscript Studio supports authenticated ORCID iDs through the ORCID OAuth 2.0 authorization-code flow.

## Scope of v1

The first version keeps the existing e-mail/password authentication and adds ORCID as a federated sign-in identity. It supports:

- discovering whether ORCID login is configured;
- starting an ORCID authorization request with the `/authenticate` scope;
- validating a single-use, time-limited OAuth `state` value;
- exchanging the authorization code on the server;
- linking a verified ORCID iD to an existing Studio account;
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

## Server configuration

Set the following variables in the server environment:

```dotenv
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_BASE_URL=https://sandbox.orcid.org
ORCID_REDIRECT_URI=https://your-studio-host.example/api/auth/orcid/callback
```

For production, set:

```dotenv
ORCID_BASE_URL=https://orcid.org
```

Register the complete HTTPS callback URI in the ORCID client configuration. The value registered at ORCID and the `ORCID_REDIRECT_URI` value used by Studio must refer to the same callback.

## Database

The Prisma schema uses `UserIdentity` for federated identities and `OAuthLoginState` for short-lived authorization state. Apply the existing migrations before enabling ORCID authentication:

```bash
cd server
npm ci
npx prisma migrate deploy
npx prisma generate
```

## First production activation

1. Register an ORCID API client for Open Manuscript Studio.
2. Register `https://openmanuscript.org/api/auth/orcid/callback` as the production redirect URI if that is the public API route used by the deployment.
3. Put the client ID and client secret in the server-side environment only.
4. Set `ORCID_BASE_URL=https://orcid.org`.
5. Restart `omi-studio-api.service`.
6. Verify `GET /api/auth/providers`; `providers.orcid.enabled` should be `true`.
7. Sign in with an existing Studio account and link its ORCID iD before testing ORCID-only login for that account.

## Security notes

OAuth `state` values are generated using cryptographically secure random bytes, stored only as SHA-256 hashes, expire after ten minutes, and are deleted when consumed. The ORCID authorization code is exchanged only by the server. Studio stores the authenticated ORCID identifier and identity metadata; v1 does not persist the returned ORCID access token.

For production, keep the API and callback behind HTTPS and never place the ORCID client secret in a `VITE_*` variable or frontend bundle.
