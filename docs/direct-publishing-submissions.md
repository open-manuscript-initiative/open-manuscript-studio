# Direct submission to OJS and OMP

Studio's **Publication → Submit an article to OJS / OMP** panel creates a new
submission using the destination's native PKP 3.5 author API. It is separate from
opening existing articles from OJS, peer review, and uploading revised files.

## Requirements and deployment

- OJS or OMP 3.5 with its matching OMI integration plugin **1.3.0.0 or later**.
- A configured, enabled per-user OJS/OMP connection in Studio. Use the context
  URL, for example `https://publisher.example/index.php/journal`, without an API
  path, query string, or embedded credentials.
- An author account and enabled personal API key in that destination. The plugin
  installation secret does not authorize authorship or creation of submissions.
- Deploy both the Studio web client and server. In `server`, install dependencies,
  run `npm run prisma:migrate:deploy`, run `npm run build`, and restart the API
  service. The migration adds `direct_submissions`; it does not change existing
  submissions. Follow the usual production backup/deployment procedure.

## Author workflow

1. Open a standalone OMI study and choose the destination in Publication.
2. Enter the personal author API key. Studio keeps it only in component/request
   memory, clears it on destination change or successful submission, and does not
   persist it in the database, browser storage, or receipts.
3. Select the supported language, journal section or optional press series, and
   manuscript file component. These choices and the submission/copyright/privacy
   requirements come from the target plugin's `submission-options` endpoint.
4. Review title, abstract, keywords, and the complete author list. Include the
   API-key owner as an author. The first listed author is the primary contact.
   The reviewed author order and names are used in the exported snapshot.
5. **Transfer and validate draft** creates a native draft, updates its metadata
   and contributors, uploads DOCX and complete OMI source files, then calls PKP's
   `submit` operation with `_validateOnly: true`. This is not a final submission.
6. Inspect the draft and export warnings. Resolve any destination-specific
   validation errors, accept the displayed terms, then **Finalize submission**.
   Only the native successful finalization is reported as submitted.

The open Studio document is not edited by this workflow. A change in the document
or form requires preparing a new snapshot before finalization. Export warnings
are shown; authors should check the transferred draft before confirming.

OMP creates a new standalone authored-work submission, with an optional series.
This workflow does **not** insert a chapter into an existing edited volume.
Submission-specific requirements not represented by these common fields must be
completed in the destination's native wizard. The draft link remains available.
An unexpected existing contributor is not silently deleted; reconcile the full
list in the native system before retrying.

## Recovery and duplicate prevention

The server records one reservation per Studio user, connection, and manuscript ID.
It stores a digest and external IDs, not the manuscript body or API credential.
Concurrent preparation requests cannot create two destination submissions. The
reservation is re-read after acquiring a lock to avoid stale IDs under concurrency.

Once the destination ID is known, retries reconcile authors and stable file names.
Changed snapshots replace existing file contents. If finalization's response is
lost, a later status check with the author key verifies native `submissionProgress`
before enabling a retry or marking success. Finalization rechecks the native state
and does not repeat completion when the destination already reports submitted.

A failed or interrupted *creation* with an uncertain remote outcome is marked
`UNKNOWN` (or remains `CREATING` after a process interruption). Studio never retries
that non-idempotent operation automatically. Check the author's native submissions
list and finish the existing draft there; an operator must reconcile the reservation
before any new creation attempt. Known HTTP 4xx rejections can be retried after
correcting the cause. Preparation locks with known IDs expire after 10 minutes;
uncertain finalization can be checked after 2 minutes.

A connection URL change cannot redirect an existing reservation to another site.
Requests use the registered public HTTPS context, reject redirects, require the
owning Studio session, and use the author's destination API key for native PKP
permission checks. The OMI plugin only exposes public submission requirements.

## Verification

After installing client/server dependencies and generating Prisma clients:

```sh
npm run test:direct-submission
npm run build
```

Tests cover native OJS/OMP field mappings, metadata/files, interrupted upload
recovery, replacement of corrected snapshots, validation failures, finalization
retries, malformed responses, source snapshot isolation, author ordering,
connection ownership, digest/consent checks, uncertain creation, and concurrent
creation reservations. Route tests run Express with mocked persistence and remote
PKP responses; they are not a substitute for a real OJS/OMP integration test.

Before release, test both plugins on PKP 3.5 with an actual author API key: include
required and optional metadata, multiple authors, submission-disabled contexts,
restricted/inactive sections, upload interruption, and final author dashboard
status. Check the DOCX and OMI files and confirm native editorial notifications
occur only upon final submission. No live production submission was made during
implementation.

## Upstream contracts

- [PKP 3.5 submission controller](https://github.com/pkp/pkp-lib/blob/stable-3_5_0/api/v1/submissions/PKPSubmissionController.php)
- [PKP 3.5 submission-file controller](https://github.com/pkp/pkp-lib/blob/stable-3_5_0/api/v1/submissions/PKPSubmissionFileController.php)
- [OMP submission schema](https://github.com/pkp/omp/blob/stable-3_5_0/schemas/submission.json)

The default native draft state, author role assignment, section/series validation,
file stage 2, author permissions, and final submission notifications stay under
PKP's control.
