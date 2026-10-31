# Stabilization phase 5: OMI-SPEC-320 / OMI-SPEC-330

**Status:** Draft implementation evidence; no conformance or specification
status promotion. This phase follows the agreed nine-stage stabilization plan
and is sequenced after the phase 4 reference/source PR.

## Normative baseline

- OMI-SPEC-320@0.3.0: logical JSON manuscript, Core Snapshot, History
  Exchange and Lossless Round Trip profiles. The published 72-requirement
  coverage inventory is a traceability map, not complete behavior coverage.
- OMI-SPEC-330@0.1.0: provisional container/package architecture. The
  canonical physical layout, compression and signature requirements are not
  yet fixed at Implementation Candidate maturity.
- The current Studio ZIP reader accepts a restricted STORE-only alpha
  container with explicit package caps, CRC-32, SHA-256, manifest and history
  checks. It does **not** implement a general ZIP or an independently
  validated standard package profile.

## Targeted evidence

| Concern | Behavior and tests | Requirement scope |
| --- | --- | --- |
| Nested images in portable state | Collect referenced image payloads from child blocks **and embedded child sections**; use identical traversal at export/import | REQ-FMT-029/034/035; 330 assets and manifest completeness |
| Authoring preview separation | Remove redundant binary previews from every section/block and from *all exported historic revision snapshots*, without mutating the canonical manuscript or author text | REQ-FMT-021/034/043/046; 330 media separation |
| Preservation of uncited assets | Fail export on missing bytes, mismatched size or SHA-256 even when asset is retained solely for preservation | 330 package integrity and manifest evidence |
| Portable archive path defense | Reject drive prefixes and control characters; refuse case- or Unicode-ambiguous export paths as well as duplicate names | 330 path uniqueness and untrusted input |
| Independent import inspection | Verify ZIP member CRC, manifest and every declared SHA-256 checksum, content-vs-head snapshot, asset identity and bytes before installing package | REQ-FMT-032/035/036; 330 package validation |

Tests use **synthetic manuscripts and payloads**. Real manuscripts and private
archive content are not committed.

## Open coverage / release barriers

- Phase 4 must be merged and accepted before phase 5 receives its completion
  gate; an independently green phase-5 PR is not proof prior stages closed.
- Specific behavior for malformed JSON members, unknown extensions and
  unsupported versions must be validated against the 0.3.0 corpus and
  independent consumers.
- Full 72-requirement OMI-SPEC-320 coverage, independent interoperability,
  profile/version negotiation, migration evidence and a stable package layout
  remain unresolved.
- Larger actual documents require asset-heavy, long-history, memory/resource
  and manual save/open checks in Web, Android and desktop builds.
- Publication artifacts bundled alongside the manuscript are auxiliary; a
  valid OMI container does not certify its JATS/HTML rendering or authorize
  public review, private data release or publishing.
- All required GitHub Actions checks and security jobs must pass prior to
  merging. No automatic status promotion or version bump.
- **Application version is held until all nine stabilization stages finish
  and are explicitly accepted**, then synchronized across app platforms
  and the OMI website.
