# Core identity and reference evidence — 2026-11-04

Twelve executable scenarios exercise Studio's actual edit, section-move, layout, deletion, checkpoint, `.omi` save/reopen and explicit revision-restoration paths. They provide **partial** observations against OMI-SPEC-000@0.2.0, OMI-SPEC-100@0.2.0 and OMI-SPEC-120@0.3.0. Existing manuscript producer declarations are unchanged.

| Requirement | Evidence |
|---|---|
| REQ-PRI-004 | Formatting and section columns retain semantic object identifiers. |
| REQ-OBJ-004 | Text edits, renaming, subtree movement and reparenting preserve identifiers and reference targets across save/reopen. |
| REQ-DOC-002 | Sections and addressable blocks retain their identifiers within the document. |
| REQ-DOC-003 | Explicit reading order survives subtree movement, reparenting and portable structural exchange. |
| REQ-OBJ-008 | Unknown references produce located errors without redirecting to another object; composed/decomposed Unicode IDs remain distinct. |
| REQ-OBJ-009 | Block-subtree deletion atomically removes affected active relationships, retains a visible unresolved-reference text marker in surviving prose and remains portable. The original relation is retained in change events and prior revision snapshots. |
| REQ-OBJ-016 | Deleted blocks, their children and removed annotations/citations/contributions get deletion evidence; new insertions reject reserved identifiers before any store notification. Explicit revision restoration preserves the historical record. |

## Defects exposed and corrected

Deleting a referenced figure previously left a dangling active cross-reference: its inline label became unresolved, but strict OMI serialization then refused to save the document. Deletion now removes affected cross-reference records and replaces surviving inline occurrences with the existing localized unresolved-reference label as ordinary text. The file-format parser remains strict. Restoring the earlier revision restores the structured reference and its target.

Deletion also previously recorded only the parent block's removal event. Descendant blocks and removed annotations/citations/contributions now have explicit deletion events, so their IDs remain reserved. Block insertion checks both retained deletion history and pending removal events, including incoming children, before publishing a working-state update.

The cleanup covers block-linked annotations, citations, citation clusters, bookmarks, cross-references, contributions and source derivations. Unrelated blocks, agents and bibliographic records remain. This is a bounded policy for `stageRemoveBlock`, not certification of every editing/deletion path or specialized relationship.

## Reproduction and evidence

Run `npm run test:core-identity`. On a committed checkout, run `npm run evidence:core-identity -- --report test-results/core-identity-reference.json`. The report generator executes the same cases, rejects uncommitted tested files, records the exact commit and file hashes, and lists per-case requirement mappings. The dedicated CI workflow uploads its freshly generated report.

The suite does not establish full model conformance, all split/merge behavior, every extension/relationship, independent interoperability or browser/native acceptance. Every mapping remains partial and the normative outcome remains indeterminate. No lifecycle promotion is requested.
