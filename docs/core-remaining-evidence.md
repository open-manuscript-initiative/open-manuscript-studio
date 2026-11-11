# Remaining core requirement evidence

Observation targets: OMI-SPEC-000@0.2.0, OMI-SPEC-100@0.2.0 and OMI-SPEC-120@0.3.0 Drafts.
Profile: `studio-remaining-core-0.1`. This is a bounded reference-implementation
observation, not stable conformance, independent verification or deployment acceptance.

`npm run test:core-remaining` executes 22 cases for the eleven requirements still
untested in the ninth core bundle. `npm run evidence:core-remaining -- --report
test-results/core-remaining.json` reruns the suite against committed source and
records its commit, source hashes, runtime and limitations. Dirty attested source
is rejected. Existing producer declarations and OMI file-format 0.3.0 stay unchanged.

| Requirement | Executed observation | Remaining limit |
|---|---|---|
| REQ-PRI-001 | Canonical state stays separate from editor selection/rendering; real model import audit and forbidden-import negatives | Incremental architecture gate, not a complete architecture audit |
| REQ-PRI-002 | Same file inspected in standalone Node and reopened locally without fetch | Shared project validator, not a second independent implementation |
| REQ-PRI-010 | Proposal leaves source untouched; explicit selected acceptance records machine/provider provenance and human actor as an unreviewed translation draft | Synthetic provider; no claim about every agent or editorial authority policy |
| REQ-PRI-011 | Unicode, language, image alternative text and table headers in actual HTML/JATS; XTG degradation warning | Selected projections, not a screen-reader or all-format accessibility audit |
| REQ-PRI-012 | Exact revisions/profiles/limitations and conservative disclosure; tampered and stale reports rejected | Local self-assessment consistency, not issuer authentication |
| REQ-PRI-014 | Unknown schema/version rejected; explicitly invoked legacy history migration remains shallow | No universal migration or historical binary compatibility claim |
| REQ-OBJ-010 | Paragraph action split/merge identity maps survive real checkpoints and portable history | Other continuous-editor and replacement paths remain unassessed |
| REQ-OBJ-011 | Addressable manuscript/section/block IDs coexist with embedded Unicode text; duplicate IDs rejected | No complete granularity audit of every object family |
| REQ-DOC-001 | Portable root declares schema, format and profiles; missing root/envelope/profile rejected | Current Studio working-file profile only |
| REQ-DOC-009 | Actual pagination changes page count without writing content; rendering does not stage edits | No browser/native visual acceptance claim |
| REQ-DOC-016 | Production collaboration initialization, Yjs update relay and awareness do not commit; explicit author edit/checkpoint does | In-memory transport, not authenticated live collaboration or editor projection |

## Identity mapping repair

The split/merge cases failed before the change: retained events contained text
and target IDs but no explicit source-to-result identity mapping. The paragraph
actions now attach the Studio-owned extension
`https://openmanuscript.org/extensions/block-identity-mapping/1` to the relevant
event. Its version 0.1.0 declares `operation`, `sourceBlockIds`, `targetBlockIds`
and `preservedBlockId`. The containing change set/event supplies revision lineage,
event ID, timestamp and any known actor. No unknown actor is invented.

Pending/checkpoint/committed event extensions detach their mutable data. The map
is provenance in history, not a grant, an editorial decision, a new core operation
or an assertion about every split/merge UI path.

## Compatibility behavior

The portable boundary still identifies OMI-SPEC-320@0.3.0 and the current schema.
Unknown future and experimental older standalone wire schemas fail explicitly.
The separate existing `migrateVersioningModel` operation can create one disclosed
shallow history root for an already understood legacy in-memory state. It never
invents earlier revisions. Retain the original when a wire file is unsupported;
do not relabel it as 0.3.0. These tests do not authorize silently migrating files.

The Node test loader additionally handles TSX and directory index imports so
the actual production collaboration initializer and its real visual extension
can execute. No rendering component is replaced by a mock.

All requirement mappings remain **partial**. Passing these cases removes the
absence of observation for these eleven IDs, not their remaining normative gaps.
