# Phase 3 stabilization: OMI-SPEC-160 / OMI-SPEC-180

Status: implementation candidate only. The normative specifications remain **Draft**.
This note follows the October 2026 nine-stage stabilization order, after the
foundation models and the identity/anchor/annotation group.

## Evidence and scope

| Contract | Applicable requirement | Evidence introduced | Still excluded |
| --- | --- | --- | --- |
| History head identity | OMI-SPEC-160 REQ-VCH-003, 011 and linear Core Revision History | Reject commits when the envelope head and lineage head disagree; regression tests | Multi-parent branch/merge histories |
| Addressable nested section identity | OMI-SPEC-160 REQ-VCH-007, 008 | Revert events and tombstone reservation now traverse embedded section children and their blocks; regression tests | General-purpose semantic tree diff |
| Validation isolated execution | OMI-SPEC-180 REQ-VAL-040, 043 | Immutable point-in-time check input prevents a mutating adapter from influencing later checks; exception is reported without manuscript text | Independent conformance certification |
| Validation source binding | OMI-SPEC-180 report processing | Existing working-state and history fingerprints remain unchanged, with additional negative regression test | Asset re-fetching on stale reports |

## Open requirements and release gates

- Studio implements a *linear* history profile. Branching and Merge requirements
  are not fulfilled merely because linear history tests pass. Never claim the
  full OMI-SPEC-160 profile set.
- The local Studio validation report format and its adapter versions are not
  a canonical OMI-SPEC-180 schema, cross-implementation report contract, or
  proof of independent implementation.
- Draft requirements for redaction of restricted history, partial ancestry,
  unknown operations and independent report validation need their own
  normative test corpus and public review.
- Static and browser E2E checks, CodeQL, release-readiness and platform tests
  must pass. Manual history round trips and privacy review are also required.
- The Phase 2 nested note/anchor/citation safety work (#788) is a separate
  prerequisite; this PR is not evidence that Phase 2 was approved or merged.
- No document content migration, publication approval, schema/status
  promotion, or application version bump is included in this change.

The proposed changes do not rewrite manuscript text or impose new author
editing restrictions. They reject only conflicting committed-history
envelopes and keep validation adapters from mutating their inspected copy.
