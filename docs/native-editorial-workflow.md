# Studio-native submission and editorial workflow

## Scope

This workflow is for publication venues that:

- are verified in Studio through the DNS TXT publication-venue authority flow;
- do **not** use an OJS/OMP integration as their authoritative editorial system.

OJS and OMP remain authoritative for submission state, reviewer assignment, review rounds, editorial decisions and publication workflow when a venue is integrated with them. Studio does not create a parallel native submission for such a venue.

## Workflow

The Studio-native lifecycle is:

```text
Author writes manuscript in Studio
        ↓
Submit exact committed revision to DNS-verified venue
        ↓
Editorial inbox
        ↓
Venue EDITOR / EDITOR_IN_CHIEF claims submission
        ↓
Scientific reviewer assignment
        ↓
Reviewer accepts, reviews and submits recommendation
        ↓
Editor completes submitted review
        ↓
Editor requests revision when needed
        ↓
Author edits manuscript in Studio
        ↓
Author submits exact revised revision
        ↓
Editor records editorial decision
        ├── request another revision
        ├── reject
        └── accept exact revision
                ↓
             ACCEPTED
                ↓
             publication
```

The author can see only author-visible reviewer feedback. Reviewer identity and editor-only feedback stay outside the author projection. Native scientific review defaults to double blind.

## Submission boundary

Submission stores a server-side snapshot of the exact committed manuscript revision together with:

- manuscript ID;
- revision ID;
- SHA-256 manuscript-state digest;
- publication venue ID;
- author account;
- review workspace ID.

The venue must have a verified DNS authority. A venue whose OJS/OMP integration status is `VERIFIED` is rejected by the native submission service.

The author receives `AUTHOR` access to the native review workspace.

## Editorial inbox and reviewer assignment

An active venue `EDITOR` or `EDITOR_IN_CHIEF` can see the native editorial inbox for venues they represent.

Taking responsibility for a submission:

- binds that editor to the submission;
- creates `EDITOR` access in the review workspace;
- records an audit event.

Reviewer assignment reuses the existing Studio peer-review engine. The reviewer receives an anonymized manuscript projection rather than the author-account identity.

## Revision cycle

After a submitted review has been completed by the editor, the editor may request a revision. The request may contain an author-facing editorial note.

The author edits the original manuscript in Studio. Resubmission stores a new exact committed revision ID, state digest and manuscript snapshot. It does not silently overwrite the previous audit events.

A resubmission does not automatically create a new peer-review round. The editor may accept the revised manuscript on the basis of the completed prior round. If the editor assigns a reviewer after `REVISION_SUBMITTED`, Studio advances the active review round exactly once and all subsequent reviewer assignments belong to that new round.

## Editorial decision is separate from publication

Editorial acceptance is **not** the act of publishing.

The editor records acceptance in the editorial workspace. Acceptance reuses the existing immutable `EditorialDecision` evidence model and requires:

- active `EDITOR` or `EDITOR_IN_CHIEF` authority at the DNS-verified venue;
- editor access to the manuscript review workspace;
- a completed Studio-native scientific review round;
- the exact revision ID;
- the exact manuscript-state digest;
- the exact publication-content digest;
- all completed scientific assignments in the selected review round.

The decision stores the publication-venue authority snapshot that was valid at decision time.

For DNS-verified native venues, the web-publishing panel no longer creates this decision. It only consumes a previously recorded editorial decision. If no valid decision exists for the exact revision, the artifact cannot carry the publisher-verified peer-review assurance.

## Publication assurance

A previously accepted revision can be used to create a peer-reviewed publication artifact. The assurance remains revision-bound: changing manuscript content invalidates reuse of the previous decision for the changed content.

The visible verified seal therefore represents this chain:

```text
DNS-verified venue
        +
authorized venue editor
        +
Studio-native completed scientific review
        +
editorial acceptance of exact revision
        +
publication artifact bound to that decision
        ↓
OMI · PEER REVIEW · VERIFIED
```

## Roles

Publication-venue authority and manuscript-workspace authority remain independent.

- `DOMAIN_ADMIN` manages venue memberships but does not itself make scholarly editorial decisions.
- `EDITOR` / `EDITOR_IN_CHIEF` authorizes venue-level editorial decisions.
- review-workspace `EDITOR` controls the specific submission and review assignments.
- review-workspace `AUTHOR` receives author-facing review results and may submit revisions.
- reviewers are assignment-scoped and do not receive venue editor authority.

## Audit model

The native workflow stores append-only workflow events for significant transitions, including submission, editor assignment, reviewer assignment, review completion, revision request, revision resubmission, acceptance, rejection and publication marking.

The current submission row represents current workflow state; the event history records how that state was reached. Only the currently assigned, still-authorized venue editor can change an accepted submission to `PUBLISHED`.

## Preview status

This workflow is currently a Preview feature. Before Stable promotion it requires end-to-end validation of at least:

1. DNS-verified author submission;
2. editor inbox and claim;
3. double-blind reviewer assignment;
4. review submission and editor completion;
5. author-visible feedback;
6. revision request and exact-revision resubmission;
7. editor acceptance;
8. verified publication artifact;
9. rejection paths and authorization failures;
10. confirmation that integrated OJS/OMP venues cannot enter the native workflow.
