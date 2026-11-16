# Studio authentication and federated identities

Open Manuscript Studio separates the local user account from the credentials used to authenticate that account.

## Domain model

`User` is the durable Studio account. `UserIdentity` links that account to one or more externally authenticated identities. The unique external identity key is `(provider, issuer, subject)`.

Initial providers:

- `ORCID`: implemented using ORCID OAuth 2.0 authorization-code authentication.
- `OIDC`: used by configured Google, Microsoft and institutional OpenID Connect providers.
- `SAML`: reserved for institutional SAML identity providers.

A user may keep local e-mail/password authentication while also linking one or more external identities. Assignment permissions, manuscript roles and privacy rules remain attached to the Studio `User`, never to the external identity.

## Account → Connected identities

The Account panel exposes authentication methods separately from scholarly profile metadata.

- The local e-mail/password credential is shown as a sign-in method when a usable password exists.
- ORCID, Google, Microsoft and institutional OIDC identities are listed with their display name, issuer, connection date and last-used timestamp when available.
- Enabled providers that are not yet connected can be linked from the same panel.
- External identities can be disconnected only when at least one other usable sign-in method remains.
- Accounts created through ORCID/OIDC without a local password must therefore set a password or connect another provider before their last external identity can be removed.
- Password setup/change uses the same one-time password-reset mail flow as forgotten-password recovery.

This lockout protection is enforced by the API, not only by the user interface.

## ORCID behavior

Studio currently requests the ORCID OpenID Connect `openid` scope (not the legacy `/authenticate` scope). The callback exchanges the one-time authorization code on the server, cryptographically verifies the returned ID token, and uses the authenticated ORCID iD as the external subject. ORCID may also return a display name; the login flow does **not** request an ORCID email address as a required identity attribute.

Studio supports three ORCID flows:

1. `login`: signs in an account that already has the authenticated ORCID iD linked. Existing Studio users with the same verified legacy `users.orcid` value are migrated to `UserIdentity` on first successful ORCID sign-in.
2. `invite`: an OJS assignment invitation can be accepted with ORCID. The pending Studio account is activated, the ORCID identity is linked, the invitation is consumed, and a Studio session is created without requiring a separate Studio password.
3. `link`: an authenticated Studio session may link an ORCID identity to the current account. The server rejects an ORCID iD already linked to another account.

OAuth `state` values are random, single-use, stored only as SHA-256 hashes and expire after ten minutes. OAuth access tokens are not persisted by the current ORCID authentication flow.

## Identity-provider data flow and privacy boundaries

The Studio supports optional ORCID, Google, Microsoft, OMI Identity and
institutional OIDC authentication; only configured providers appear in the UI.
The real OpenID Connect authorization request for Google/Microsoft and a
generic institution uses `openid profile email` (OMI Identity additionally
requests `orcid`). In addition to the verified provider `issuer` and
stable `subject`, an ID token or a validated UserInfo response may supply
the account display name, email address and `email_verified` claim.
Microsoft's `preferred_username` is **not** evidence of a verified mailbox.
Google and generic institutional auto-registration require the provider's
verified-email evidence; linked roles and institution ownership are never
granted based solely on email equivalence.

The Identity database stores provider/issuer/subject, limited display-name,
email and verification metadata plus last-used timestamps for linked accounts.
The code exchanges single-use authorization codes server-side and does not
persist external account passwords or the login exchange access/refresh
tokens in those identity records. This is not a statement about unrelated
cloud-drive or publishing integrations, whose scopes and credential retention
must be audited separately.

The identity provider's own authentication service has its own data-handling
policies; the selected Studio controller remains responsible for data it
receives, account linking, protection, rights handling and the lawfulness
of any international transfers. Do **not** use an unconditional
“no responsibility for external providers” disclaimer in notices.
Document the actual activated providers, purposes and lawful basis,
their role and any necessary transfer arrangements.

See [ORCID Privacy Policy](https://info.orcid.org/privacy-policy/),
[Google Privacy Policy](https://policies.google.com/privacy) and
[Microsoft Privacy Statement](https://www.microsoft.com/en-us/privacy/privacystatement).

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

- `GET /api/auth/providers` reports enabled identity providers and whether configured providers are already linked.
- `GET /api/auth/identities` returns the signed-in account's local password status and linked external identities.
- `DELETE /api/auth/identities/:identityId` disconnects one external identity while enforcing last-sign-in-method protection.
- `GET /api/auth/orcid/start?mode=login` begins ORCID sign-in.
- `GET /api/auth/orcid/start?mode=invite&invite=...` accepts a Studio assignment invitation using ORCID.
- `GET /api/auth/orcid/start?mode=link` links ORCID to the currently signed-in Studio account.
- `GET /api/auth/orcid/callback` is the registered ORCID OAuth redirect endpoint.

## Future providers

Institutional OIDC and SAML adapters use the same `UserIdentity` model. Provider-specific claims must be normalized to a stable issuer and subject. No provider is allowed to grant manuscript access directly: authentication resolves a Studio `User`; the existing Studio authorization/capability layer then determines access.

Automatic account merging must not be performed from display names or unverified e-mail claims. Account linking requires either an authenticated Studio session, a valid Studio invitation, or an explicitly verified migration rule.
