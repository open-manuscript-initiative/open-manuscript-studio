# ADR-029 — Translation privacy and Draft application boundaries

Date: 2026-10-31. Status: Proposed repair; retain the working model/history/renderers.

## Problem and decision

The first translation HTML renderer used every annotation body collected for the private translation workspace. A reviewed alignment did not prove public visibility. Parallel and target proofs could disclose hidden/editor-only annotations. A pure synthetic negative fixture reproduces this boundary failure.

Public text proofs now admit annotation bodies only through `isPublicPublicationNote`, the same predicate used by ordinary publication exports. Apply this before collecting export units and before checking readiness. Exclude private bodies, target text and source anchors in both modes. Re-evaluate current visibility on every export: old reviewed status cannot override a newly private note. Private/stale/unreviewed workspace notes do not block a public proof; new or stale public units do. Preserve the original blocks for existing source fingerprints and leave the entire source/translation ledger untouched. No authoring lock, destructive redaction or automatic transmission is introduced.

These proofs are public text exports, not anonymous review projections or peer-review certificates. Source/variant IDs remain intentionally identified. Anonymous review continues to require its separate server-side audience projection. A confidential/internal proof mode would need a new explicit authority and audience contract, not an option that bypasses this filter.

## Application ownership

`createTranslationCommands(TranslationSessionPort)` owns create/edit/synchronize/archive/remove and pending-change/checkpoint orchestration. The synchronous update port must atomically apply a transform; failed transforms commit nothing. `src/app/translationActions.ts` is a compatibility/composition adapter for Zustand, account→agent lookup and the existing checkpoint engine. No alternative store or revision engine is introduced. Tests exercise both the plain session port and the actual existing store, save/reopen and revision reversion.

The existing `urn:omi:studio:translation:1`, `studio-translation-0.1` and `translation.model.set` remain experimental implementation contracts. JSON-path anchors are editor-adapter locators, not frozen OMI-SPEC-110 anchors or ContentCodec completion. Keep source fingerprints and shifted-path stale detection. Before a stable translation contract, define and test a versioned editor-independent mapping with explicit conversion; never silently reinterpret saved paths. Unknown future profiles remain opaque and noneditable in this workspace. No schema/container version bump or DB migration is required by this repair.

## Exchange and evidence ownership

`ExportExchangeSession` owns source/report creation, adapter warning collection, byte/envelope inspection, cancellation, delivery result and failure transitions. UI owns selection, notices and platform delivery; existing renderer and sidecar logic remains. `prepareOfficeImport` continues to own source receipt preparation independently of React. The format switch remains a composition step; the complete importer/renderer registry, streaming contracts, target semantic validation and uninstrumented routes are follow-up work, not completed 1.0 guarantees.

Keep these contracts separate: `omi-studio-validation-report` (manuscript observation), `omi-studio-exchange-report` (one conversion), `omi-studio-conformance-report` (build/suite self-assessment), `omi-studio-core-review` (bounded Draft projection), and the existing publication-build manifest. No successful envelope check proves target semantics; no local report grants publication/review authority. Passing an unapproved/incomplete suite remains indeterminate, never a Stable promotion.

## Collaboration policy reconciliation

ADR-028 remains the authority for the implemented single-node whole-manuscript collaboration profile. Accepted current database membership and ACTIVE account determine access; portable contributor/translation data cannot grant it. Admission and every live message are rechecked, idle recheck is 15 seconds, authorization deadline is five seconds. VIEWER downgrade is read-only; revocation, expired ticket or unavailable authority closes the connection. A fresh ticket/reconnect is required and pending local edits cannot override server denial. Existing semantic revision history stays separate from transport updates. Whole-manuscript translator access is not fine-grained segment permission. No central/institutional role implies manuscript access.

## Alternatives and consequences

- Removing private notes from the saved manuscript loses author data: rejected. Use a nonmutating export view.
- Requiring private-note review before public output creates an unrelated authoring burden: rejected. Check only the output's permitted units.
- Replacing Tiptap, Zustand, Yjs or revision history is unnecessary. Introduce small ports around the existing behavior.
- Calling a local self-assessment canonical conformance or production security evidence is rejected. Preserve exclusions and existing RC gates.

## Tests and reconsideration

`translation-public-export.test.ts` runs in the mandatory release-security suite and translation regression suite: private/hidden/workflow/origin notes, public notes, late visibility/source edits, both modes and unchanged authoring state. Existing translation action/roundtrip/history tests cover the command adapter; a plain session tests use cases without React/Zustand/account state. Exchange tests cover bytes, warnings, rejection before inspection, cancellation and failure. Existing collaboration live-policy and ticket tests remain mandatory.

Revisit on canonical 170/180 schemas, ContentCodec adoption, segment permissions, new export audiences, additional renderer paths or an approved 350 suite. Before RC, require cross-surface adversarial anonymity, independent interoperability, deployed authorization and exact-candidate artifact evidence in addition to unit tests.
