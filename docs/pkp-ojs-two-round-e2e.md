# OJS 3.5 two-round double-blind E2E protocol

Purpose: prove that OMI Studio preserves OJS review-assignment, blinding and review-round boundaries across two complete review rounds.

This protocol should be executed against a disposable OJS 3.5 test submission with distinct author, reviewer and editor accounts. Record the OJS submission ID, review assignment IDs, review round numbers, file IDs and screenshots/log evidence for each checkpoint.

## Preconditions

- OJS 3.5 test journal with the OMI Studio Integration plugin enabled.
- Studio server configured with the OJS installation and shared secret.
- One editor, one author and one reviewer account.
- Double-blind review enabled for the test workflow.
- A native OJS review form with at least:
  - one required text field;
  - one author-visible field;
  - one editor-only field;
  - one choice field;
  - localized HU/EN/DE labels where available.
- At least two native reviewer recommendation options enabled in the journal.

## Round 1

### 1. Author submission

1. Submit a manuscript through OJS.
2. Ensure the source file contains author identity in metadata or source material that OJS should not expose to the reviewer where the configured blind-review workflow removes it.
3. Record submission and source-file IDs.

Expected:

- OJS is the authoritative submission record.
- Studio author access does not grant reviewer/editor-only scopes.

### 2. Editor assignment

1. Create review round 1.
2. Assign the reviewer.
3. Select the exact review file(s) available to that assignment.
4. Assign the native review form.

Record the round-1 review assignment ID and allowed review file IDs.

### 3. Reviewer launch boundary

Launch Studio from the reviewer workflow.

Expected:

- Launch identifies the reviewer, submission and exact review assignment.
- Studio cannot enumerate contributor identity.
- Studio cannot access reviewer-management/editor scopes.
- Only files explicitly attached to the assignment are listed.
- Direct access to another submission file ID returns a denial.

### 4. Review form

Expected:

- The form definition is the OJS-assigned native form.
- Required flags are preserved.
- Author-visible/editor-only semantics are preserved.
- Active Studio locale selects the matching OJS localization when present.
- Missing localization falls back to OJS-provided default text, never machine translation.
- Submitting with a required field empty fails.

### 5. Reviewer response

1. Enter an author-visible comment.
2. Enter a confidential editor-only comment.
3. Fill all required review-form elements.
4. Select a native OJS recommendation once native recommendation mapping is enabled.
5. Save a reviewer working revision if applicable.
6. Submit the review.

Expected in OJS:

- Author-visible comment is stored in the author-visible channel.
- Confidential comment remains editor-only.
- Native review-form responses are attached to round-1 assignment.
- Native reviewer recommendation ID is stored on round-1 assignment.
- No reviewer account identifier leaks into author-visible data.

### 6. Author visibility check

Log in as the author and inspect the response made visible through normal OJS workflow.

Expected:

- Editor-only text is absent.
- Reviewer identity is absent under double-blind policy.
- Only data OJS marks for author inclusion is visible.

## Revision between rounds

1. Editor requests revisions in OJS.
2. Author opens the authorized revision in Studio when author revision writeback is enabled.
3. Author edits and returns the revised file through the native OJS revision workflow.

Expected:

- Original submission file is not silently overwritten.
- Revised file is associated with the correct OJS workflow stage/round.
- Reviewer-only data is unavailable to the author.

## Round 2

### 7. Create round 2

1. Create a second OJS review round.
2. Assign the same or a different reviewer.
3. Select round-2 review files.
4. Assign a review form.

Record the round-2 review assignment ID and file IDs.

### 8. Isolation assertions

Launch Studio for round 2.

Expected:

- `reviewRound` is 2.
- Round-2 assignment ID differs from round 1.
- Round-1 form responses are not treated as round-2 responses.
- Round-1 recommendation is not preselected unless OJS explicitly supplies it for round 2.
- Round-1 reviewer working revision does not replace round-2 source.
- File access is recalculated from the round-2 assignment.

### 9. Submit round 2

Complete and submit a second review with deliberately different form values, comments and recommendation.

Expected:

- OJS contains distinct round-1 and round-2 results.
- No comments, responses, file IDs or recommendations are written to the wrong assignment.

## Negative security tests

Run all of the following at least once:

- Replay the same signed launch assertion: Studio rejects it.
- Modify launch payload without recomputing signature: rejected.
- Use an expired assertion: rejected.
- Request a file not assigned to the reviewer: rejected.
- Request a review form using another assignment ID: rejected.
- Submit a review-form element not belonging to the assigned form: rejected.
- Submit an invalid choice value: rejected.
- Submit an OJS recommendation ID that is unavailable to the journal/assignment: rejected once native recommendation writeback is enabled.
- Attempt writeback to an untrusted/redirected OJS URL: rejected.

## Pass criteria

The E2E test passes only when:

1. All round boundaries remain intact.
2. No author/reviewer identity disclosure occurs outside OJS policy.
3. OJS remains authoritative for files, forms, recommendations and workflow state.
4. Every foreign OJS identifier is validated before writeback.
5. Round-1 and round-2 data remain independently addressable after completion.
6. CI and security scanning are green for both Studio and the OJS plugin versions under test.

## Evidence record

For each run, append or attach:

- OJS version and plugin version;
- Studio commit/build;
- submission ID;
- round-1/round-2 assignment IDs;
- relevant file IDs;
- locale(s) tested;
- pass/fail for each checkpoint;
- links to CI runs;
- screenshots or redacted API traces where useful.