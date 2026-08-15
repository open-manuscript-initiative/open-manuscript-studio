# Studio authentication and federated identities

Open Manuscript Studio separates the local user account from the credentials used to authenticate that account.

## Domain model

`User` is the durable Studio account. `UserIdentity` links that account to one or more externally authenticated identities. The unique external identity key is `(provider, issuer, subject)`.

Initial providers:

- `ORCID`: implemented using ORCID OAuth 2.0 authorization-code authentication.
- `OIDC`: reserved for institutional OpenID Connect providers.
- `SAML`: reserved for institutional SAML identity providers.

A user may keep local e-mail/password authentication while also linking one or more external identities. Assignment permissions, manuscript roles and privacy rules remain attached to the Studio `User`, never to the external identity.

## ORCID behavior

Studio requests the ORCID `/authenticate` scope. The callback exchanges the one-time authorization code on the server and uses the authenticated ORCID iD returned by ORCID as the external subject.

Studio supports three ORCID flows:

1. `login`: signs in an account that already has the authenticated ORCID iD linked. Existing Studio users with the same verified legacy `users.orcid` value are migrated to `UserIdentity` on first successful ORCID sign-in.
2. `invite`: an OJS assignment invitation can be accepted with ORCID. The pending Studio account is activated, the ORCID identity is linked, the invitation is consumed, and a Studio session is created without requiring a separate Studio password.
3. `link`: an authenticated Studio session may link an ORCID identity to the current account. The server rejects an ORCID iD already linked to another account.

OAuth `state` values are random, single-use, stored only as SHA-256 hashes and expire after ten minutes. OAuth access tokens are not persisted by the current ORCID authentication flow.

## Configuration

ORCID is disabled until both client credentials are configured. The normal e-mail/password login remains available regardless of ORCID configuration.

Production example:

```env
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_BASE_URL=https://orcid.org
ORCID_REDIRECT_URI=https://studio.openmanuscript.org/api/auth/orcid/callback
```

Sandbox example:

```env
ORCID_CLIENT_ID=APP-...
ORCID_CLIENT_SECRET=...
ORCID_BASE_URL=https://sandbox.orcid.org
ORCID_REDIRECT_URI=https://studio.openmanuscript.org/api/auth/orcid/callback
```

The redirect URI must exactly match the URI registered for the ORCID OAuth client. Production ORCID clients require HTTPS redirect URIs.

## HTTP endpoints

- `GET /api/auth/providers` reports enabled identity providers and, when a Studio session exists, whether ORCID is linked.
- `GET /api/auth/orcid/start?mode=login` begins ORCID sign-in.
- `GET /api/auth/orcid/start?mode=invite&invite=...` accepts a Studio assignment invitation using ORCID.
- `GET /api/auth/orcid/start?mode=link` links ORCID to the currently signed-in Studio account.
- `GET /api/auth/orcid/callback` is the registered ORCID OAuth redirect endpoint.

## Future providers

Institutional OIDC and SAML adapters should use the same `UserIdentity` model. Provider-specific claims must be normalized to a stable issuer and subject. No provider is allowed to grant manuscript access directly: authentication resolves a Studio `User`; the existing Studio authorization/capability layer then determines access.

Automatic account merging must not be performed from display names or unverified e-mail claims. Account linking requires either an authenticated Studio session, a valid Studio invitation, or an explicitly verified migration rule.
