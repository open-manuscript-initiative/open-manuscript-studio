# ADR-034 — Privacy API and partial account overview

Date: 2026-11-08. Status: proposed drift repair; source/CI acceptance is separate
from deployment and operator legal acceptance. Refines ADR-012/015/016/017/019.

## Context

Studio commit `a829afba6eb6e9a68da34a9bc21d0315101c7536` introduced useful
operator notices and private account copies at unversioned endpoints. OMI commit
`2491bc0f54b0a02cea6bcf5d1dcb98b969d7ac18` documented those URLs. The new
surface lacked the additive v1/shared DTO contract and repository boundary.

## Decision and authority

- `/api/v1/privacy` is public and sends no session credentials from the client.
  `/api/v1/account/data` requires the current active account session. Account IDs
  supplied in URLs/query strings never select the exported account.
- `/api/privacy` and `/api/account/data` remain temporary compatibility facades
  over the same router, authentication, use case and **single shared limiter**.
  They emit `Deprecation` and a v1 `successor-version` link. A content-free
  `privacy-api-legacy-route` event records only one of the two fixed route names;
  operators can count use before deprecation. No removal date is set here.
- `server/src/contracts/privacyContract.ts` is the executable Zod response/error
  source; the client imports generated dependency-free DTO types only. The generated
  [OpenAPI 3.1 document](../api/privacy-v1.openapi.json) must match it in CI. Regenerate with `npm run api:privacy:generate`.
  Account dates are UTC ISO strings, each relation is capped at 1000, and
  `incompleteSections` names truncated relations. Strict objects reject added
  secret fields. `omi-account-overview/1` versions the body, independently of HTTP.
- The application service owns export scope, truncation, date serialization and
  wire validation. Its injected repository port owns persistence access. Prisma
  selection and optional working-role column compatibility live in identity
  repository adapters; existing service imports retain compatibility re-exports.
- HTTP owns session admission, no-store/nosniff, attachment headers, generic
  errors and a server-generated `X-Request-Id`. Errors use `{error:{code,message}}`:
  401 `NOT_AUTHENTICATED`, 404 `ACCOUNT_NOT_FOUND`, 429 `RATE_LIMITED`,
  500 `ACCOUNT_EXPORT_FAILED`, 503 `IDENTITY_UNAVAILABLE`. Neither private DB
  errors nor incoming account identifiers enter responses or deprecation events.
  These read-only GET operations need no write idempotency key or optimistic version.
- The selected server's actual operator supplies/reviews public controller facts.
  A notice or `operatorReviewed` flag is not identity proof, an editorial grant,
  certification or peer-review evidence. The identity database remains account/
  authentication/membership authority; review/manuscript authorities stay separate.
- The overview is explicitly **partial**: selected profile/email/sign-in metadata,
  memberships, sessions and passkey labels, without secrets, manuscript/review
  content, shared history, operational logs or external copies. Full access,
  portability, erasure and third-party-rights decisions remain operator workflows;
  this endpoint does not automatically disclose shared or confidential material.
- Account download uses the existing platform transport for native credentials.
  Public notice fetches remain anonymous. Switching native origin does not carry
  the old token to the new server. SecureStorage/origin-cache work remains separate.

## Alternatives and consequences

Reject an in-place URL rename (breaks deployed clients), separate legacy handlers
(policy/quota divergence), a new identity database, complete-user serialization,
and labelling this limited copy a full rights response. Preserve current features
and manuscript editing. This change introduces no OMI/container field, connector
protocol, data migration or document editing restriction.

Deploy API before updated web/native clients; verify both route families before
client promotion. Preserve the existing optional-role migration procedure and
missing-column fallback. Old clients retain the legacy routes. Missing reviewed
operator facts still require operator action; merging source does not fill them in.

## Acceptance and revisit

`npm run test:privacy` checks generated OpenAPI parity, strict secret rejection,
account isolation, alias quota sharing, no-store/errors, truncation, notice safety,
expiry-only cleanup and native selected-origin transport. Keep it mandatory in
CI; require its result on the same RC candidate under existing identity/API/privacy
release gates. Browser notice checks cover anonymous access, responsive text and
unsafe links. Authentication/optional-role regressions also run after adapter moves.

Mocked persistence is not PostgreSQL/host or legal acceptance. Before promotion,
operators verify reviewed controller facts, authenticated download, logging and
recovery on their deployment. No existing E02/manual/security gate is waived.
Revisit on export-scope/schema expansion, new identity authority, aggregation of
shared/review data, topology changes or a proposed legacy removal policy.
