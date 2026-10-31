# ADR-028: Draft exchange, capability and collaboration policy integration

Date: 2026-10-31. Status: Accepted implementation decision; specifications remain Draft.

## Context

OMI-SPEC-190, OMI-SPEC-340 and OMI-SPEC-350 Draft 0.1.0 were published in the reference documentation. Existing file adapters, validation reports and accepted-invitation collaboration provide a base but do not establish conformance to those specifications. Canonical wire schemas and approved suites are still absent.

## Decision

Use explicitly Studio-owned, versioned implementation profiles. Preserve normal manuscript editing. Keep exchange reports (one transformation), validation reports (one manuscript) and self-assessment evidence (one implementation build) separate.

### OMI-SPEC-190: trusted service boundary

`server/src/services/collaborationPolicy.ts` declares document-scoped role-to-action expansion and fail-closed decisions. Account/contributor labels, administration and invitations do not create grants. Unknown roles, scope mismatch, revocation, explicit denial and invalid/expired evidence deny access. The existing membership database remains authoritative; portable manuscript extensions cannot issue local grants.

Ticket admission checks active account status and current accepted membership. Live connections recheck those facts before each message and on a 15-second idle sweep. A five-second authorization deadline closes a connection when authoritative evidence is unavailable. Downgrading an AUTHOR/EDITOR to VIEWER makes the connection read-only; revocation, disabled account or expired ticket closes it. Reconnect obtains a fresh ticket through the authenticated API, using the same Yjs document and pending transport state; server permission remains decisive. The existing immediate disconnect on member removal is retained.

This is the existing **single-node, whole-manuscript** deployment profile. Viewer export is an explicit existing policy grant, separate from content editing. Manuscript contributors do not receive permissions from their scholarly role. Editorial approval and policy management are not implied by any collaboration role. Session updates remain transport events, not semantic revision commits. Federation, fine-grained translation scopes, delegation, independent audit integrity and complete cross-surface review anonymity remain outside this implementation claim.

### OMI-SPEC-340: reviewable office import and reported standard export

DOCX and ODT preparation retains the immutable original File separately from the editable candidate. The review panel offers the original and a JSON receipt, including after parser failure or cancellation. Source digest and byte length identify the input without embedding private source text in the report. Existing parser warnings are included with their available source part. An edit to the current workspace during preparation prevents stale candidate acceptance. Confirming creates the normal editable manuscript; neither receipt nor source attribution adds an editor lock.

The standard export panel binds reports to the actual generated artifact bytes and the source snapshot, including the enriched source used by `.omi` packaging. Empty artifacts, failed envelope checks, execution failure and cancelled native delivery are distinguished. Existing JATS validation/release gates and publication sidecars remain in force. Adapter warnings are retained in the exchange report.

Report format: `omi-studio-exchange-report`, version `0.1.0`; mapping IDs `urn:omi:studio:mapping:<direction>:<format>`, revision `0.1.0`. Profile changes affecting semantics require a revision change. External format edition detection remains unknown rather than guessed. JSON reports identify their experimental status and do not claim a canonical OMI wire schema.

Feature inspection is incomplete. Successful conversion reports conservatively use `completed-with-loss`, with an explicit no-lossless/no-round-trip statement; this includes unverified preservation and does not invent an exact loss count. Parsing is identified separately from OMI-SPEC-180 manuscript validation. The declared minimum export check is nonempty output plus recognized ZIP/PDF envelope where applicable, not target semantic correctness. Round-trip invariant comparison returns indeterminate when either side lacks evidence; it is a utility, not proof that every adapter has a round-trip evaluator.

Receipts/reports are **session-local** in their panel. Save the JSON report and original before leaving the panel or reloading. Leaving the panel does not alter the user's source file. Custom-template exports, integration/direct-submission exports, PDF import and portable OMI import retain their existing flows and are not covered by this new report instrumentation. Anonymous-review export safety and all accessibility/language equivalences remain unassessed; these reports do not authorize confidential release.

### OMI-SPEC-350: declaration and bounded self-assessment

The Validation view now contains Implementation capabilities. It can download a build/platform-bound capability statement and run a synthetic local model self-assessment. Conditional server capability explicitly requires a matching enabled server and current membership; a client declaration does not attest an independently selected remote server.

The suite pins its profile/version, cases, fixture digests, actions, expected outcomes and all 72 numbered requirements of OMI-SPEC-340/350 Draft 0.1.0. The seven local cases provide **partial evidence** for selected report and claim-gating behavior. Every other requirement is explicitly not-run. A negative fixture whose expected denial succeeds is a passing test, not a claim of complete normative requirement coverage.

Evidence binds the suite digest, build/revision, root dependency-lock digest, runner revision, environment and timestamp. Integrity/freshness checking rejects a changed build/dependency set, suite, environment or modified results. A mandatory behavioral failure yields nonconformant; missing coverage, harness error, skipped results or an unapproved suite yield indeterminate. The local suite is unapproved and incomplete, so a passing run still reports **indeterminate**, self-assessment and not-independent. No certificate, Stable lifecycle promotion or independently verified claim is produced.

CI runs the regression tests and records `test-results/draft-model-assessment.json` as an uploaded artifact. `npm run conformance:draft-models` reproduces that report locally. It exits unsuccessfully on model test failure/error; indeterminate normative coverage itself is expected and is not disguised as certification.

## Validation

- `npm run test:draft-models`: exchange receipts, failure handling, byte digests, scope/role/denial policy, mandatory gating and stale evidence.
- `npm run test:collaboration-invitations`: existing invitation/ticket/routes plus live message-boundary reauthorization, downgrade and unavailable authority.
- `e2e/draft-models.spec.ts`: desktop/mobile disclosure and evidence download; original-file recovery and stale workspace protection.
- Existing validation, import/export, editing/deletion and full build/lint checks remain applicable.

## Normative basis

- [OMI-SPEC-190 Draft 0.1.0](https://openmanuscript.org/docs/specifications/collaboration-permission-model/)
- [OMI-SPEC-340 Draft 0.1.0](https://openmanuscript.org/docs/specifications/import-export-model/)
- [OMI-SPEC-350 Draft 0.1.0](https://openmanuscript.org/docs/specifications/capability-conformance-model/)

This ADR describes implementation evidence and explicit gaps; it is not an assertion of full compliance with any of those Drafts.
