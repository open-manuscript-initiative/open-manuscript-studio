# ADR-038 — Live publication style snapshot and OJS handoff

Date: 2026-11-18. Status: maintainer-approved direction; proposed implementation pending merge/CI and separate deployment acceptance. Refines ADR-009/010/014/017/019/032/037.

## Decision

Connect the live continuous publication editor to the existing OJS production artifact adapter. Let the editor select HTML and/or one PDF mode, prepare every selected output, preview and explicitly confirm transfer. Keep OJS stage/role/publication authority and the current immutable source history. No automatic publication, scientific acceptance, external review seal or authoring restriction is introduced.

`prepareOjsPublicationOutputs` is an application operation with renderer injection for tests. The UI supplies the committed manuscript plus the exact current React style and publisher identity, not a later local-storage reread during an asynchronous build. Renderers clone that context. The existing profile's `publicationStyle` field carries the snapshot into the existing profile digest; the existing artifact and renderer-input digests bind actual output bytes and rendered branding. A local context fingerprint only invalidates stale UI state. It is not a new portable identifier, signature, review authority or state-digest algorithm.

HTML remains responsive semantic publication content. PDF applies the same style snapshot's print rules, page geometry, running headers and print-only proof corrections through Studio's configured PDF renderer. The separate frame-story designer remains separate; this feature does not assert a new complete scholarly mapping for it. Existing public projections filter private notes and identity data. Referenced images must be embedded from verified registered bytes (HTML raster subset; PDF retains SVG support behind the existing isolated offline renderer); no remote fetch or unchecked source payload is added to the publication.

Before each remote file operation, recheck current source identity, current style/identity fingerprint and destination/server scope. Bind the exact submission, current publication, locale, genre and inspected workflow token. Verify each returned format/build/SHA-256 and native galley receipt, with `provenanceVerified=true` and `published=false`. OJS independently rechecks permissions, native state/token and artifact provenance before and inside its persistence transaction.

The group of files is deliberately not claimed atomic. Stop on a missing/mismatched/lost receipt or changed local context, retain confirmed earlier receipts and require reinspection/new explicit confirmation. Do not automatically replay, undo a confirmed native file or silently substitute a newly edited source. The existing OJS logical-galley/unchanged-build behavior remains the only native idempotency mechanism.

## Compatibility and acceptance

Reuse the existing publication-artifact route/protocol and build model; existing single-artifact/JATS and OMP paths remain. No schema/container/API generation or database migration. Workflow-token support requires plugin 1.7+, and the complete 1.8.3 package is the recommended current install. No new native OJS task-writeback, proof approval or external assurance capability is advertised.

Mandatory synthetic coverage: publisher style/profile and renderer-input binding, public HTML structure, PDF input and validity, one/both output selection, unavailable/oversized formats, mutable-input snapshot isolation, source/style/server changes, exact receipt checks, partial success and no replay. Desktop/mobile browser tests exercise selection, previews, confirmation and both transferred formats. They run in the existing browser smoke gate; unit coverage joins `test:publication-artifact` in CI and Readiness. Preserve existing PKP, security, PostgreSQL and exact-candidate/manual acceptance requirements. A mocked PDF or OJS response is not live provider evidence.

Real acceptance needs distinct OJS editor accounts, an unpublished Production article, the configured PDF service/fonts, HTML reader, layout comparison, metadata/stage changes in another tab, interrupted second-file transfer and final native editorial publication. Do not promote capability or claim operational certification from unit/browser mocks.

Revisit for frame-rendition handoff, native OJS production assignments, OMP parity, batch atomicity/outbox, receipt persistence or changed build/schema semantics. Retain the working source, style editor, renderer and native adapter on rollback; existing OJS files are not deleted by rolling back Studio.
