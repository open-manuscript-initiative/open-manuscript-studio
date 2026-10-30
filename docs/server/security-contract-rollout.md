# Security contracts and rollout — 2026-10-30

This runbook records the implemented contracts at Studio main `540f67a018b200d21c5c74d98c3fe80ada8260c6`. It supplements ADR-012, ADR-015, ADR-016, ADR-017 and ADR-019 in the [1.0 baseline](https://github.com/open-manuscript-initiative/omi/tree/main/docs/governance/studio-1.0-architecture). It does not certify an installation or freeze all legacy routes as API v1. No schema, container, manuscript-editing rule or database migration changes here.

## Verified administrator bootstrap

`centralAdminService.ts` and `institutionAccessService.ts` use `findVerifiedFederatedIdentity`. Automatic provisioning requires all of:

- ACTIVE Studio account;
- its normalized email in `CENTRAL_ADMIN_EMAILS` or `INSTITUTIONAL_ADMIN_EMAILS`;
- a linked OIDC/SAML identity profile whose `emailVerified` is boolean `true` and normalized `email` equals the account email;
- for institutional provisioning, institutional deployment mode and configured institution name.

An unrelated linked identity, missing claims, Microsoft `preferred_username`, ORCID, password or passkey alone does not satisfy bootstrap. Explicit central-operator creation also checks the candidate's ACTIVE account and verified matching federation, under a central OWNER's authorization. Existing grants are not automatically revoked or reverified on every request. An identity link does not itself prove scholarly authorship or review authority.

### Rollout and recovery

1. Keep an existing authorized owner session while checking a second operator in a separate browser session. Check the effective deployment allow-lists without copying addresses or tokens into public issues/CI logs.
2. Reauthenticate through the trusted configured IdP. Confirm that its supported claim mapping writes boolean `emailVerified: true` and the matching email to the linked identity profile. Do not manufacture this evidence by editing profile JSON or treating a username as verification.
3. If bootstrap remains unavailable, correct the trusted IdP configuration and repeat authentication/linking. An existing central OWNER may grant an eligible central operator; central/institutional ownership operations still enforce their existing role and last-owner safeguards.
4. Review older central grants and institutional OWNER memberships privately against current evidence and operator approval. Missing evidence means review is needed, not automatic revocation. Remove an address from bootstrap configuration before revoking its grant; otherwise a later access may provision it again. Retain another tested owner and record changes through existing admin audit paths.
5. If no authorized operator or trusted federation is available, use the installation's controlled incident-recovery process with independently verified operator authority and restricted audit records. There is no new break-glass bypass or automatic recovery CLI in this change. Do not disable verification or grant privileges from an unverified email to restore service.

## HTTP Origin and authentication

`app.ts` mounts `cookieOriginGuard` globally, including legacy and v1 routes. For POST/PUT/PATCH/DELETE carrying `omi_session`, require an exact allowed Origin: the URL origin of `FRONTEND_ORIGIN`, `tauri://localhost`, `http://tauri.localhost` or `https://tauri.localhost`. Missing/opaque (`null`) or foreign Origin fails with HTTP 403, `COOKIE_ORIGIN_FORBIDDEN`, `Cache-Control: no-store`. `Sec-Fetch-Site: cross-site` also rejects an otherwise matching Origin. CORS may reject a foreign Origin earlier; a CSRF exception does not bypass CORS.

| Exception | Origin guard behavior | Authority still required |
|---|---|---|
| GET/HEAD/OPTIONS, or no `omi_session` cookie | Guard does not reject | Route authentication/authorization still applies; safe methods must remain nonmutating |
| Native `X-OMI-Native-Client: 1` and syntactically nonempty `Authorization: Bearer …` | May omit Origin, even with an incidental cookie | `requireSession` validates bearer first; invalid bearer must not fall back to a valid cookie. Header marker alone grants nothing |
| POST exactly `/integrations/ojs/review/launch` or `/integrations/omp/review/launch` | May omit Origin | Active Studio session plus verified one-time signed PKP assertion, expiry/nonce and reviewer scopes in the launch handler |
| Service-authorized OMP revision callback | No special browser-session exception added | Existing service authorization remains; no unsigned or anonymous callback is enabled |

Browser clients keep credentialed fetch from an approved origin. Native clients send the explicit marker and session bearer; do not invent an Origin to bypass authentication. Server scripts using cookies must set the approved Origin or use the route's supported bearer authentication. Never put tokens in URLs. Keep negative tests for missing/invalid credentials and both mount families; do not broaden exceptions to `/integrations/*`.

Rate limiting precedes JSON parsers. The listed large document endpoints in `app.ts` additionally run `requireSession` before JSON decoding. PDF raw import authenticates and checks admission before its raw parser. This does not imply that all connector endpoints can authenticate before reading their signed payload.

## PDF admission and worker boundary

| Resource/response | Implemented contract |
|---|---|
| Active jobs, queued plus processing | 1 per user, 2 per API process |
| Retained jobs, including completed/failed | 12 per user, 100 per API process |
| User active/history cap | 429, `PDF_IMPORT_USER_BUSY` / `PDF_IMPORT_USER_HISTORY_FULL` |
| Process active/history cap | 503, `PDF_IMPORT_SERVER_BUSY` / `PDF_IMPORT_SERVER_HISTORY_FULL` |
| Capacity retry | HTTP route sends `Retry-After: 60`; no retry of a successfully accepted job |
| Raw input | Binary Buffer, `%PDF-` header, maximum 100 MiB; existing 2,000-page limit |
| Retention | Process-memory registry; lazy expiry at 30 minutes from creation; restart loses job/results |

The pre-body admission check is an early rejection, not a reserved upload slot. Concurrent uploads can pass it together; synchronous admission immediately before job insertion remains authoritative. Multiple API processes multiply these limits; rendering has no equivalent global admission guarantee. Do not describe these controls as distributed capacity management or durable recovery.

Poppler and Vivliostyle inherit allow-listed runtime variables only through `pdfWorkerEnvironment.ts`. Secret sentinel tests cover the actual subprocess environment. HOME/font/cache paths passed to Vivliostyle are not isolation. See [PDF worker limitations](pdf-worker-environment.md) and [outbound resource controls](outbound-resource-security.md).

## Mandatory release evidence and remaining work

- `npm run test:release-security`: malformed cookies, verified federation, Origin exceptions, admission, subprocess secret exclusion and connector IP checks, including existing hostile synthetic cases.
- `npm run test:security-boundary-contracts`: real HTTP middleware/auth/parser ordering and service-level administrator provisioning regressions. Database/session lookup and repository writes are mocked; this is not PostgreSQL or external-IdP acceptance.
- Controlled acceptance: approved browser/native writes, invalid-bearer rejection, both signed PKP launch flows, existing-grant review and second-owner recovery. Record only content-free outcomes tied to commit and artifact digest.
- Before RC promotion of PDF processing: separate least-privilege worker identity/container, no access to API `.env`/DB secrets, bounded CPU/RAM/pids/temp storage, and verified outbound deny policy (#774); connection-time private/link-local/metadata denial against rebinding (#765). Maintain legitimate external storage/publishing paths, fonts and embedded images.
- Before multi-instance PDF support: distributed admission/lifecycle design and concurrent-instance tests. Until then declare the process-local limitation and size deployments accordingly.
- E02 must aggregate unit, HTTP, actual deployed isolation/egress, PKP and installer/platform evidence for the same candidate commit/artifact. A passing unit suite or environment allowlist does not complete OS-security gates. Do not mark issues #774/#765 closed from these tests.

Roll back a failed deployment to a reviewed artifact with equivalent security controls, or disable only the affected server-side feature under the incident procedure. Do not remove Origin checks, restore environment inheritance or weaken bootstrap verification as a compatibility fallback. Manuscript authoring/editing remains available independently of publication/import service admission.
