# Studio-native submission and editorial workflow

Status: **Preview**

Open Manuscript Studio can own the submission, peer-review and editorial-decision workflow for a DNS-verified journal or press that does not use OJS or OMP.

This workflow is deliberately separate from the PKP integrations:

- when OJS is authoritative for a journal, submission, review rounds, assignments and editorial decisions remain in OJS;
- when OMP is authoritative for a press, those workflow objects remain in OMP;
- Studio-native workflow is available only for a publication venue with verified DNS TXT authority and no verified OJS/OMP workflow binding.

## Workflow

```text
Author writes a manuscript in Studio
        ↓
Submit exact committed revision to a verified venue
        ↓
Editorial inbox
        ↓
Editor assigns one or more scientific reviewers
        ↓
Reviewer accepts the assignment and works in Studio
        ↓
Reviewer submits feedback + recommendation
        ↓
Editor completes the submitted review assignment
        ↓
Editor chooses
   ├── request revision
   ├── reject
   └── accept
        ↓
If revision is requested:
Author edits the manuscript and submits a new committed revision
        ↓
Editor either accepts the revision on the existing completed review evidence
or starts a new scientific review round
        ↓
Editorial ACCEPT decision
        ↓
Publishable
        ↓
Publication
```

Editorial acceptance and publication are separate operations.

## Submission snapshot

A native submission stores server-side workflow state rather than modifying portable manuscript semantics. The submitted object contains:

- publication venue ID, verified domain and venue name;
- author account ID;
- manuscript ID;
- exact committed revision ID;
- canonical manuscript-state SHA-256 digest;
- publication-content SHA-256 digest;
- canonical manuscript-state snapshot;
- an anonymous reviewer projection;
- binary manuscript assets with SHA-256 verification;
- workflow status and review round;
- an append-only workflow event trail.

The manuscript remains the canonical scholarly object. The workflow database stores the editorial relationship to a particular committed state.

## Reviewer privacy

The anonymous review projection is generated without author identity. Studio-native scientific review defaults to double blind.

Author-facing review APIs do not expose reviewer account identity. Editor-facing APIs may show the author and assigned reviewer because editors need those identities to administer the workflow.

Confidential `EDITOR_ONLY` feedback is never returned through the author-facing projection.

## Editorial authority

Every editor action is authorized twice:

1. the account must have an active `EDITOR` or `EDITOR_IN_CHIEF` membership at the publication venue;
2. the venue must still satisfy the DNS-verified Studio-native authority boundary.

Review-workspace `EDITOR` access is then synchronized for that concrete submission. Persistent workspace access cannot replace venue authority: removing the venue role removes the ability to administer the native submission.

## Review rounds and revisions

A scientific reviewer assignment is bound to:

- one submission workspace;
- one manuscript;
- one review round;
- one anonymous manuscript snapshot.

A submitted reviewer report is explicitly completed by an editor.

If an invited reviewer declines, that assignment remains in the audit history but is not decision-bearing review evidence. A replacement reviewer can be assigned in the same round; once all non-declined scientific assignments in that round are completed, the round can support revision or acceptance.

A revision request requires the current scientific review round to be completed. When the author submits a revised committed manuscript, Studio records a new revision ID and state/content digests and advances the review round.

After a revised submission the editor may:

- accept the new exact revision based on the most recent completed scientific review evidence; or
- assign a reviewer in the new round. Once a new round has started, acceptance cannot fall back to an older completed round while the current round is unfinished.

## Editorial decision

Final acceptance reuses the immutable Studio `EditorialDecision` model.

The decision is bound to:

- submission workspace;
- manuscript ID;
- exact revision ID;
- canonical state digest;
- publication-content digest;
- completed scientific review assignment IDs;
- review round;
- deciding editor;
- DNS-verified publication-venue authority snapshot.

For a DNS-verified publication venue, the deciding user must also be an active venue `EDITOR` or `EDITOR_IN_CHIEF`.

Changing the manuscript after acceptance creates a different state/content digest and invalidates reuse of that acceptance for the changed content.

## Publication

An accepted native submission becomes **publishable**. Acceptance does not itself publish anything.

The web publication panel consumes the existing editorial decision. For a Studio-native DNS venue it does not create the acceptance as part of the publication action.

After an accepted exact revision is actually published through a supported web target, Studio marks the native submission `PUBLISHED` and records that transition in the workflow event log.

## OJS/OMP boundary

The server rejects Studio-native submission workflow for a venue with a verified authoritative OJS/OMP binding.

This prevents parallel competing workflow state such as:

```text
OJS says: revision required
Studio says: accepted
```

or:

```text
OMP says: review round 2
Studio says: review round 1
```

For integrated venues, Studio remains the structured authoring/review client and the external publishing platform remains the workflow authority.

## Workflow states

| State | Meaning |
| --- | --- |
| `SUBMITTED` | Author submitted an exact committed revision |
| `IN_REVIEW` | At least one reviewer is assigned in the active round |
| `REVISION_REQUESTED` | Editor requested author changes |
| `REVISION_SUBMITTED` | Author submitted a new committed revision |
| `ACCEPTED` | Editor recorded an immutable acceptance for the exact revision |
| `REJECTED` | Editor rejected the submission |
| `PUBLISHED` | The accepted revision was externally published |

## Related documentation

- [Publication venue registry and DNS authority](./publication-venue-registry.md)
- [Website publication assurance](./newsletter-web-publishing.md)
- [Editorial assignment roles](./server/editorial-assignment-roles.md)
