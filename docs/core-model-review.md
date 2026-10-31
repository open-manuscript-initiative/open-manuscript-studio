# Core model review implementation

Experimental profile: `urn:omi:profile:core-snapshot-review:0.1.0`, targeting proposed OMI-SPEC-000@0.2.0, 120@0.3.0, 100@0.2.0 and 140@0.2.0 Drafts. The [pinned companion specification change](https://github.com/open-manuscript-initiative/omi/commit/644afdf2bd551a333116276ace86f5ec85df1a46) publishes the core projection schema, pure validator and corpus. This code does not alter existing producer specification declarations or OMI-SPEC-180 report contracts.

The Validation view has a separate Core model review panel. Authoring mode permits an empty title; exchange mode requires a title. A run checks an isolated current-state JSON projection and exports timestamped, source-digest-bound diagnostics without manuscript excerpts. Historical snapshots are outside the live-ID uniqueness scope. Editing or selecting a different mode makes the displayed report stale. No source mutation, forced repair, editing lock, remote fetch or automatic publication is introduced.

`src/model/coreSnapshotValidator.mjs` is shared code from the specification repository; `tests/fixtures/core-review/provenance.json` pins its SHA-256. The 22 fixtures and their manifest are vendored exactly. This is not independent implementation evidence. The corpus accounts for 66 requirements, of which 20 have partial evidence and 46 are untested. Complete conformance, external review and Stable promotion remain open.

Default limits are 100,000 JSON nodes, depth 64 and 200 diagnostics. Unknown block semantics and exhausted limits yield incomplete inspection; observed errors retain invalid outcome. Full relationship semantics, specialized inline content, revision correctness, permission/anonymity, rendering and accessibility are excluded. Existing Studio validation continues to check its own declared areas separately.

Validation: `npm run test:core-review`, `npm run test:validation-model`, existing full tests/build/lint and `e2e/core-model-review.spec.ts`. This PR is stacked on the Draft model integration PR #785 so the existing capability panel is preserved.
