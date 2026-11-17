# Editorial production: copyediting, layout and proof approval

Status: **Preview**. Implementation and automated contract tests are present;
real PostgreSQL and browser CI gates plus real PKP acceptance evidence are
required before describing the complete workflow as production-verified.

## Authority and scope

For OJS/OMP-connected submissions, the external platform owns workflow stages,
assignments, decisions and publication. Studio-native production is available
only after acceptance of a DNS-verified native venue submission. It cannot be
used to accept, approve or publish an OJS article by creating parallel native
state.

The production record is server workflow data. It is not added to portable OMI
semantics, and does not change OMI-SPEC-320 or turn Draft specifications stable.

## Native workflow

| Stage | Required work | Exit condition |
| --- | --- | --- |
| COPYEDITING | Open the accepted source; submit an edited committed source if required | Author and active venue editor approve the exact source file |
| LAYOUT | Editor explicitly accepts the approved source for production; layout editor prepares HTML/PDF | A proof build matches the source revision and state digest |
| PROOFREADING | Author/proofreader records located corrections; layout editor records their disposition | Author and editor approve the current proof, with no unresolved corrections |
| READY | Final proof is ready for delivery | Live delivery must use that exact revision, state and artifact digest |

Scientific acceptance, copyedited-source approval and final-proof approval are
separate records. Merely completing a task does not approve publication.

The initially accepted source is archived as an immutable production file.
Every replacement source/proof creates another file. Existing file bytes are
never updated by production operations. The workflow retains the initial source
reference and an event history; source and proof history are downloadable only
by current authorized production participants.

If copyediting changes the source, entering LAYOUT creates a separate editorial
acceptance for the new exact revision, using the original scientific review
evidence. That decision and the promotion of the source occur in one database
transaction. The editor must decide whether the changes instead require a new
scientific review; production does not invent a positive review for changed text.

A different source returns to COPYEDITING and clears both source and proof
approvals. A different proof returns to PROOFREADING and clears both proof
approvals. All outstanding corrections need a recorded disposition before
replacing their source/proof. Earlier corrections and files remain historical.
An identical proof retry preserves existing approvals.

## Roles

| Actor | Allowed operations |
| --- | --- |
| Submitting author | Read source/proofs; approve the exact source/proof; request located corrections |
| Active venue editor | Assign/revoke tasks; approve source/proof; move stages; authorize publication |
| COPYEDITOR | Read production material and submit an edited source |
| LAYOUT_EDITOR | Read production material; build/submit proofs; record correction dispositions |
| PROOFREADER | Read production material and request corrections |

A task is assigned to an active Studio account, optionally with a due date.
The participant can find it under Editorial workflow → My production assignments.
Due dates are recorded and displayed; this implementation does not send mail or
schedule reminders. Menu preferences do not grant any of these permissions.
Revoking a task removes its access, unless the account independently retains
another valid role on the submission. Native venue authority is rechecked for
editorial operations.

## Client behavior

Source approval requires opening the current source first. Proof approval requires
opening the current proof first. Server authorization still checks the exact
file ID and current workflow version independently of the client UI.

HTML previews use an iframe with an empty sandbox; document markup is not inserted
into Studio's DOM. PDF and historical files use the existing web/native export
save adapter, including Android's Documents provider. Cancelling a native PDF save
does not enable proof approval. The interface is supplied in HU/EN/DE, with the
existing English fallback for other interface locales.

The native proof UI supports HTML, print PDF and interactive PDF. Each approved
proof is one exact format/build. Approving a PDF does not approve a separate HTML
artifact. Before native website delivery, generate and approve the HTML proof
with the same reviewed-assurance selection and publication profile as the website
panel. Any content, assurance notice or profile change requires a new proof.

## API

All endpoints require the authenticated Studio account and return `no-store`.

- `GET /api/native-editorial/production/tasks`
- `GET /api/native-editorial/production/{submissionId}`
- `POST /api/native-editorial/production/{submissionId}`
- `GET /api/native-editorial/production/{submissionId}/files/{fileId}`

Mutations contain `{ "version": 4, "command": { "type": "…" } }`.
Commands are START, ASSIGN, REVOKE, SOURCE, APPROVE_SOURCE, LAYOUT, PROOF,
CORRECTION, RESOLVE, APPROVE_PROOF and READY. Actor identity comes from the
server session. Client-supplied actor/privilege fields are rejected.

The parent native submission is locked before mutation; a stale version returns
409. Files must belong to that production record. Proof transfer validates the
complete publication-build manifest, committed revision/state, exact bytes,
SHA-256, deterministic build ID, format and filename. A proof is at most 32 MiB.
Invalid transfers roll back the file and workflow changes.

Live native web publication checks readiness when issuing the approval grant and
again while atomically claiming the durable delivery. The second check holds the
same parent-row lock used by production changes. An IN_FLIGHT, UNKNOWN or
SUCCEEDED live delivery blocks further production changes until the delivery is
reconciled. A client cannot bypass this check by calling the published-status
endpoint directly. Draft web delivery does not claim that the final proof is
approved or that the venue submission has been published.

## OJS inspection and stale-target protection

OJS Integration source 1.7.0.0 adds an editorial, submission-scoped
`GET /api/v1/omi-integration/workflow-status?submissionId=…` projection.
The Studio proxy uses the owning user's enabled OJS connection and that
installation's personal editorial credential. It never accepts a destination URL
from the request body. It does not expose this endpoint through an OMP connection.

The publication-artifact panel can refresh the native stage and selected metadata,
compare the article title, and show pages, issue ID and publication date.
It does not automatically overwrite metadata in either system.

An artifact inspection returns `workflowToken`. Updated clients echo it as
`expectedWorkflowToken` when transferring. OJS rechecks it before transfer and
again under the submission/publication locks. A changed stage/publication/selected
metadata returns 409 and requires reinspection. Older clients may omit the token.
This token covers the projected state; it is not a complete revision token for
every OJS object or a proof-approval assertion.

## Rollout and verification

1. Review migration `20261116010000_add_editorial_production`, back up PostgreSQL,
   and apply it with the existing migration rollout procedure before deploying
   the updated API. It adds two tables and does not rewrite existing submissions.
2. Generate both Prisma clients and deploy server and client together.
3. Install the matching OJS plugin before using workflow inspection. Existing
   OJS submission/review/publication authority is retained.
4. Run `npm run test:editorial-production`, the normal client build, and relevant
   publication/review regression gates.
5. Run the PostgreSQL CI gate with OMI_TEST_POSTGRES_URL. It applies the exact SQL
   to an isolated schema and checks CAS, JSON task isolation, constraints and
   cascade cleanup. It must not point to production.
6. Run `e2e/editorial-production.spec.ts` and the real OJS two-round and production
   acceptance protocol in `editorial-workflow-priorities.md`.

The existing deployment scripts deliberately stop on an unreviewed migration.
This change does not add itself to their reviewed-SQL allowlist or apply a live
migration. Do not treat mocked HTTP tests as evidence of a live OJS installation.
