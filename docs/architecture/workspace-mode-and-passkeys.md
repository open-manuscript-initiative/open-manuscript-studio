# Workspace mode and passkey boundaries

Editor selection is an application concern and is not stored in portable OMI,
hashes or revision snapshots. The former simple-writing-mode preference is no
longer read; older values in `omi-document-workspace-modes` are ignored. Unknown
imported extensions are retained; legacy `editorMode` data is not silently
deleted or treated as authorization. The vendored schema matches the OMI source;
there is no Studio-only schema field.

## Passkey API v1

Base: `/api/v1/auth/passkeys`. Compatibility base: `/api/auth/passkeys`.
Both mounts use the same handlers and authentication rate limiter.

| Method | Suffix | Authentication | Result |
|---|---|---|---|
| GET | (base) | Session | `{ passkeys: [...] }`, no credential material |
| POST | `/registration/options` | Session | WebAuthn registration options |
| POST | `/registration/verify` | Session | `{ challenge, response, label? }` → 201 `{ ok: true }` |
| DELETE | `/:passkeyId` | Session | Owned credential removal → 204 |
| POST | `/login/options` | None | Discoverable WebAuthn authentication options |
| POST | `/login/verify` | Assertion | `{ challenge, response }` → existing account session |

Failures preserve `PASSKEY_REGISTRATION_FAILED`, `PASSKEY_LOGIN_FAILED` and
`INVALID_PASSKEY_ID` error envelopes. All passkey responses are no-store.
Routes own HTTP/cookies; `passkeyService` owns use cases; `passkeyRepository`
is the identity database adapter. No biometric templates are stored.

Support: secure web origin with a platform authenticator; RP and origin derive
from FRONTEND_ORIGIN. Native Tauri passkeys are not advertised until a verified
browser/native handoff is implemented and tested. Do not broaden the origin
allowlist as a substitute. Passkeys are local account authentication, not scholarly
identity, institution membership, publication evidence or editorial authority.

The route regression suite mocks WebAuthn and persistence. Real authenticator,
PostgreSQL migration, invalid signature/origin/RP and native handoff evidence must
still be supplied before the corresponding capability is declared stable.
