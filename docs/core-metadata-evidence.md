# Core metadata evidence — 2026-11-04

Twelve scenarios exercise contributor editing, identifier normalization, metadata updates, revision checkpoints, portable save/reopen, source attribution and non-mutating validation against the exact Draft targets OMI-SPEC-000@0.2.0, OMI-SPEC-120@0.3.0 and OMI-SPEC-140@0.2.0.

They provide **partial** observations for REQ-MET-001 (subject/property/value), REQ-MET-005 (distinct assertion/visibility states), REQ-MET-010 (syntax versus verification), REQ-MET-012 (retained provenance), REQ-OBJ-014 (asserted versus verified attribution), and further REQ-MET-018 preservation evidence. Producer declarations and specification lifecycle states are unchanged.

## Corrected behavior

- Re-entering the same ORCID, including its HTTPS form, preserves existing assertion IDs, source, status, timestamp and visibility. An unrelated edit also preserves identifier evidence.
- A changed ORCID starts a new self-asserted claim, clears proof tied to the old value and retains the previous visibility policy.
- An unchanged affiliation organization/ROR retains its existing identifier assertion and provenance, including when department information changes.
- A newly entered or replaced ROR is self-asserted. Matching a ROR string's shape does not prove registry resolution, identity ownership or organizational membership. A new value no longer gains `verified` status or an invented API source automatically.
- Selecting a ROR search result explicitly records the lookup source as provenance while retaining self-asserted affiliation status. This source assertion is not authentication evidence or a permission grant.
- Scholarly and OJS Open Science metadata edits use structural metadata change events with exact subject/property/value paths, rather than being mislabeled as abstract edits.

No historical verification assertions are globally reclassified. Existing verified assertions remain intact when unchanged; real-world verification of those assertions is outside these tests.

## Scope and reproduction

The fixtures preserve unverified, self-asserted, verified, rejected, withheld and absent identifier states. Machine-inferred, author-declared and author-confirmed source relationships survive save/reopen without promotion, and provisional bibliography records stay provisional. A real metadata edit records the manuscript subject, metadata property and value in its change event. Validation does not elevate unverified metadata.

Run `npm run test:core-metadata`. On a committed checkout, `npm run evidence:core-metadata -- --report test-results/core-metadata.json` executes the same cases and records commit, file hashes, target revisions and requirement mappings. The dedicated CI workflow uploads a fresh report; the normal test chain includes this suite.

Every mapping remains partial. Generic metadata assertion profiles, all import/conversion paths, real-world identity/membership verification, server authorization and independent interoperability remain open. These tests preserve synthetic claims; they do not certify actual people or institutions.
