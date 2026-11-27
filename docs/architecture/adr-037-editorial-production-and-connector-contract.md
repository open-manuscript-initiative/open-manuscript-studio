# ADR-037 — Editorial production, API and publishing profile boundaries

- Date: 2026-11-18
- Status: proposed repair; authoritative after companion merge and CI. Deployment acceptance remains separate.
- Refines: ADR-005/006/009/010/014/015/017/019/021/032/033.

## Decision

Keep the working copyediting, layout and proof workflow. A Studio-native venue owns server-side production state (`omi-editorial-production/1`) and immutable source/proof files. Production is not portable OMI metadata, scientific-review evidence, an account role preference or an external OJS/OMP decision. No schema/container generation changes.

Scientific acceptance, copyedited-source approval and final-proof approval are separate. The explicit editor transition to layout accepts a changed exact source using the recorded review basis; it does not assert that reviewers reviewed the changed text. Review policy must decide when another scientific round is necessary. OJS/OMP bindings are rejected by native production authority. External publishing systems remain authoritative for their own stages, identities and publication decisions.

For a native submission, live website publication requires READY plus the approved exact source revision/state and artifact bytes. Source/proof changes invalidate the appropriate approvals. The source/proof files and events remain historical. This is a server delivery gate, never an authoring lock: every part of the working manuscript remains editable; changed content requires a fresh proof/approval before delivery. Standalone public-interest/non-reviewed artifacts retain their existing explicitly disclosed publication path.

## API and persistence

- Canonical production paths: `/api/v1/native-editorial/production`, with tasks, submission commands and participant-only file downloads. The previous `/api/native-editorial/production` remains a shared-handler compatibility facade with Deprecation/Link headers; no removal date is promised.
- Canonical connection profile paths: `/api/v1/integrations/connections/:id/{editorial-capabilities,workflow-status,metadata,omp-workflow-status,omp-metadata,chapter-page-range,issue-page-range}`. Matching legacy paths use the same handlers and deprecation headers. Existing submission/artifact APIs are not silently renamed.
- Zod request/response DTOs produce the checked OpenAPI snapshot `docs/api/editorial-v1.openapi.json`; client types refer to the same DTOs. HTTP owns parsing, status, no-store and correlation. New clients use selected-origin web/native transport and current origin-scoped credentials.
- Production services use a semantic repository port. The Prisma adapter owns queries, immutable byte inserts, parent-row locks and CAS. Source replacement, exact editorial acceptance, assets and production state commit/rollback together. The web-delivery adapter bridge retains its original atomic production-readiness/outbox claim; no split transaction is introduced.
- Recheck editor/assignment authority after waiting for the production row lock. Version is a required CAS precondition. Stale versions/tokens return 409. Unknown outcomes require reload/reinspection, never automatic replay. This repair does not invent a distributed ACID transaction or a durable metadata outbox.
- Unsupported future private production models fail closed. Any incompatible persisted-state evolution requires a separate explicit migration. The existing reviewed additive production-table migration is retained; this repair adds no database migration.

## Connector profile contract

`omi-publishing-editorial/1` is a bounded common capability projection with explicit provider/authority and independent boolean features. Discover capabilities from the owned enabled native connection, validate its native protocol/profile, and recheck support on each editorial operation. Advertised support never grants object/stage permission; the native endpoint must still authorize every operation.

OJS maps `editor.workflow.read` to `omi-ojs-workflow/1`, and `editor.metadata.reconcile` to `omi-ojs-metadata/1`. Selected locale/field writes need exact publication ID/token, native permission and matching receipt. The snapshot filters private contributor fields. Rich abstracts are an explicitly lossy plain-text profile, not a lossless OMI mapping. A timeout/lost receipt means inspect and compare before any retry.

The OMP Preview adapter independently maps `editor.workflow.read` to `omi-omp-workflow/1` through `omp-workflow-status`, and `editor.metadata.reconcile` to `omi-omp-metadata/1` through `omp-metadata`. Capabilities are enabled only when the owned connection advertises the exact OMP protocol/profile and the specific feature; old plugins report false. OMP workflow reads retain series/work-type fields rather than inventing OJS issue/page fields. Metadata requests bind installation, press, submission and current publication on inspection as well as apply. OMP responses and receipts are validated independently. The OJS metadata/workflow routes reject OMP connections, including when an OMP plugin advertises an identically named feature. Native copyediting write, proof approval and external peer-review assurance remain false for both profiles.

OMP adapter evidence includes authenticated HTTP tests using the real bounded native client, denied/foreign connections, missing capabilities, foreign publication/press/receipt, stale native state, native permission revocation and lost-response no-replay checks. Browser fixtures cover explicit selected-field confirmation, capability refusal, stale state and uncertain writes. These transport/domain fixtures do not certify a native OMP deployment: exact-candidate PKP/browser production acceptance is still required before feature promotion. OMP remains Preview. This slice does not freeze the complete Publishing System Connector contract.

The OJS plugin's 1.8.3 main/package repair supplies archive-extraction/native-install checks. It is stronger evidence than helper-presence checks; archive bytes, tagged source, native PKP matrix and deployed installation still need distinct receipts. Do not downgrade to an incomplete package or infer host acceptance from green repository tests.

## Evidence and rollout

Mandatory CI and 1.0 Readiness run production domain/HTTP and metadata-profile suites, shared v1/legacy negative cases, checked OpenAPI, native origin switching, proof integrity/approval invalidation and authorization after lock acquisition. Preserve the PostgreSQL migration/CAS gate, browser production tests, six PKP E02 matrix jobs and all current exact-candidate manual gates. The existing OJS manual gates must cover the new metadata/stale-state workflow and exact plugin version/package digest when those features are in release scope. No gate count/receipt version is silently changed; old receipts do not certify new code.

Keep real OJS two-tab stale metadata, stage revocation, two-round review, copyediting/production and unpublished galley acceptance separate from PHP doubles. Native production needs distinct author/editor/task accounts on the deployment. Source tests are not operational certification or Stable promotion.

Roll out the already-reviewed database migration and verified backups, API with both mounts, then clients and the matching plugin. Older clients keep their facades. Roll back adapters/API independently while retaining production rows/files and existing native/OJS authority. No destructive migration or authority bypass is a rollback strategy.

## Alternatives and consequences

Reject removing the new workflow, mass-renaming all routes, copying OJS state into native authority, enabling unimplemented OMP parity, and loosening the proof gate to keep old clients green. Keep the current editor/renderers and working outbox. Some older backend services still access Prisma and the full common connector freeze remains follow-up work; this bounded repair does not relabel them complete.

Revisit for multi-node production, new proof formats, automatic retries/outbox for remote metadata, native OJS task writeback, OMP parity, new external assurance authority, persisted model changes or capability promotion.
