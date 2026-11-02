# OIDC, ORCID and JWKS outbound SSRF hardening

**Status:** Draft security PR. No changes to VPS systemd, Plesk or shared runtime UID.

## Threat model

OpenID Connect metadata returned from a trusted configured issuer can contain
URLs for token exchange, UserInfo, and JWKS signing keys. These are server-side
HTTP requests, often carrying authorization codes, client secrets or access
tokens. A preflight DNS check does not prevent DNS rebinding: the actual
connection must use the inspected address. Built-in `jose` Remote JWK Set
retrieval must use the same protected transport; library-default network
behavior is insufficient when the Studio API permits loopback for PostgreSQL.

## Controls

- Validate configured issuer and metadata URLs: HTTPS, no embedded URL
  credentials, no fragments and no private/reserved literal IPs.
- Validate discovered `issuer` against configured `issuer` before relying on
  the metadata. Only the documented public-cloud Microsoft
  `{tenantid}` template is accepted for `common`, `organizations` or
  `consumers`; a validated concrete tenant is still required for signing
  key selection and token verification.
- Retrieve OIDC/ORCID metadata, token exchange, UserInfo and remote JOSE
  JWKS via the connection-pinned #823 transport. Never follow HTTP redirects.
  Preserve Host/SNI and TLS certificate verification.
- Bound discovery (64 KiB), UserInfo (128 KiB), token (128 KiB), and JWKS
  (512 KiB) responses. Keep JWT issuer, audience, nonce and subject checks.
- Delete failed discovery promises from the cache so a transient failure
  does not permanently disable a provider until restart.

## Release acceptance

The new isolated `npm --prefix server run test:oidc-ssrf` suite must
pass under GitHub Actions after server dependencies are installed.
Also verify real user login and native login handoff to all enabled
providers: ORCID Sandbox/Production as configured, central OMI Identity,
Google, Microsoft and institutional OIDC (if enabled). The operator
must verify both account linking and sign-in; do not attempt a login
with a nonexistent external identity or real user's account without
their authorization. Confirm credentials, tokens and codes are absent
from normal logs.

Provider endpoints in an RFC1918-only network are now intentionally
blocked even if an operator configured such an issuer. Institutions
requiring private OIDC must deploy a properly secured public HTTPS
endpoint or design a separately authorized outbound exception; do not
weaken the global public-host SSRF rule.

The #822 service-level BPF policy stays scoped to the API service.
This change is **not** proof that every other server-side URL handler is
SSRF-safe; EuroOffice callbacks and further OAuth helpers require
their own review.
