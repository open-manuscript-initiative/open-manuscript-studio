# External editor and recognition safety

## Deploy and rollback

1. Back up PostgreSQL. Close active EuroOffice editors and allow their final save callbacks to finish before deploying.
2. Apply `server/prisma/migrations/20261018120000_integration_execution_boundaries` with the existing Prisma deployment command. Old sessions are expired because they have no trustworthy base-revision binding; reopen editors after deploy.
3. Deploy the API before the frontend. New clients use `/api/v1`; legacy routes remain facades over the same handlers. The tables are additive. Before rolling back to old code, disable EuroOffice and paid Transkribus execution (module installation allowlist) and drain editors; old code does not supply the required bound-session fields and does not honor paid intents. Do not restore old write endpoints against this schema or drop recovery snapshots/paid intents. Re-enable only with a schema-aware safe API.

Neither this change nor its tables modify OMI schemas, manuscripts or OMI history.

## EuroOffice

`euroOfficeService` owns use cases, `euroOfficeRepository` owns persistence and transactions. The configured editor origin, expiring capability, document key and owner remain authoritative. Callback URLs are never logged or persisted; their digest is the receipt identity. No bearer key or DOCX data is included in error messages.

Status 6 is a normal repeated force save. It is stored as an immutable recovery snapshot, leaving the canonical head unchanged. Status 2 is the final close-save. It replaces the canonical bytes only if the head still equals the session's starting revision. The prior head, new bytes and callback receipt commit atomically under a document row lock. Duplicate callbacks are acknowledged without reapplying. Late/conflicting saves remain recoverable and cannot replace a newer head. Owners can list/download snapshots from the document list; downloads never silently restore a head. A force-save snapshot after a crash must be recovered by download. Do not label provider software `history.serverVersion` as a monotonic document-save sequence.

The incoming fetch rejects redirects and nonconfigured HTTPS origins, caps actual streamed bytes at 25 MiB, and validates ZIP integrity, CRC, required OPC/XML parts and expanded limits (25 MiB/part, 100 MiB total, 4096 entries). DTD/entities, encryption, symlinks and ZIP64 are rejected. This is bounded package validation, not full OOXML schema/rendering conformance. Recovery retention/storage quotas require a separate reviewed policy; this repair does not silently delete snapshots.

Owner API: `/api/v1/eurooffice/documents/:documentId/saves` and `.../saves/:saveId`. Callback protocol: `/api/v1/integrations/eurooffice/:documentId/{content,callback}`. Legacy mounts are retained. A recovery receipt exposes metadata only; DOCX bytes require an owner-authenticated download.

## Transkribus

Connection and jobs move additively to `/api/v1/integrations/transkribus/...` and `/api/v1/modules/critical-text-edition/transkribus/...`. The module middleware issues a five-minute server grant. The recognition service validates its actor, workspace and capability and binds a durable intent to connection ID, configured provider origin, image digest, model, purpose, uploaded-image scope and request key before the paid POST. No source image, provider credential, filename or recognized text is stored in this ledger.

`SUBMITTING` means a paid POST may be in flight; a crash can leave that state behind. Expired in-flight status is presented as `UNKNOWN`. `ACCEPTED` records the provider process ID and allows a repeated request with the same payload/key to read the existing job. `UNKNOWN` never triggers another paid submission under that key. Reusing a key for another image/model/connection/origin returns `TRANSKRIBUS_IDEMPOTENCY_CONFLICT`. The browser persists a request UUID plus local input fingerprint before submitting. Legacy callers receive a deterministic request key.

`GET /api/v1/modules/critical-text-edition/transkribus/executions/:requestKey?workspaceId=...` returns the caller's intent status and accepted handle, without source content or credentials. Unknown provider outcomes require external reconciliation; this does not claim exactly-once external billing or automatically discover a lost process ID. Do not discard an unknown record to trigger a generic retry. The existing provider/job handle remains account scoped. Uploaded-image grants do not authorize automatic confidential manuscript/reviewer exports.

## Platform and evidence

Both clients use `studioApiTransport`, resolving native endpoint/token for each request. Origin switching clears the previous bearer through the existing platform adapter.

Synthetic gates: `npm run test:eurooffice`, `npm run test:transkribus`, the general unit suite and the separate `Integration state PostgreSQL gate`. The database gate creates isolated synthetic schemas and verifies migration/session invalidation, competing final callbacks, prior-head recovery and paid-intent uniqueness. It never uses a private manuscript or production database.

Real EuroOffice force-save/final-close/crash behavior, real Transkribus credit/network reconciliation, and native/web receiver acceptance are still required before Stable promotion. Existing Android iframe bounds work is retained.
