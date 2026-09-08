# Direct author submission to OJS and OMP

Open Manuscript Studio can submit an open **standalone OMI study** directly to a configured Open Journal Systems (OJS) journal or Open Monograph Press (OMP) press. The workflow is exposed from the **Publication** view and keeps the Studio manuscript separate from the remote submission state.

## Eligibility

Direct submission is available when the open document has the OMI document-structure profile `kind: study`. A volume is not submitted as a journal article or individual press submission through this workflow.

New standalone DOCX imports are explicitly assigned the study profile. Studio also repairs the profile when it loads older DOCX imports created before this rule was introduced. OJS articles opened through the current integration path are likewise imported as standalone studies even when their source file contains several sections.

Generic legacy OMI documents without an explicit structure profile are not guessed to be studies; the compatibility fallback remains a volume profile. This avoids silently reclassifying older ambiguous documents.

## Submission workflow

1. Open the standalone study in Studio and choose **Publication**.
2. Select a configured OJS or OMP destination.
3. Select the target OJS section or OMP series and review the submission metadata and contributors.
4. Studio creates a native remote draft and transfers the reviewed metadata plus both the DOCX and OMI source representations.
5. Studio asks the remote PKP application to validate the draft before final submission.
6. Resolve any validation errors. Final submission is enabled only after the preparation/validation phase succeeds.
7. Confirm the final submission. OJS or OMP remains authoritative for the subsequent editorial workflow.

The reviewed submission snapshot is used for the outgoing metadata and files; preparing the submission does not rewrite the currently open manuscript merely to match remote form fields.

## Reliability and retry behavior

The transfer is designed to be restartable and idempotent:

- an interrupted preparation can resume against the already-created remote draft instead of creating a second submission;
- existing transferred files are reused or replaced as appropriate, rather than duplicated;
- correcting a prepared draft replaces its source files;
- remote validation errors stop the workflow before final submission;
- repeated finalization after a lost response does not intentionally submit or notify twice;
- invalid remote identifiers and malformed submission states are rejected before finalization;
- duplicate author e-mail addresses are rejected in the outgoing submission input.

## OJS and OMP responsibility boundary

Studio is the structured authoring and transfer workspace. OJS/OMP remains authoritative for submission identifiers, workflow stages, assignments, review rounds, editorial decisions and publication state. Direct submission therefore uses the supported PKP-facing integration/API layer rather than writing directly to a PKP database.

## Troubleshooting

If Publication reports that no standalone study is open:

- update Studio to a release containing the standalone-study detection fix;
- for a DOCX manuscript, close and reopen/reimport it so the document profile can be normalized;
- for an OJS article persisted by a Studio version older than the explicit OJS study-profile fix, reopen the article from OJS;
- verify that the document is genuinely a study rather than an OMI volume.

If the destination is missing, verify the configured OJS/OMP connection and the signed-in account's access to that destination. If remote validation fails, correct the reported metadata or PKP-side requirement before trying final submission again.

## Related implementation

The direct-submission implementation is covered by focused tests for native OJS/OMP draft creation, metadata/contributor transfer, DOCX and OMI file upload, remote validation, interrupted-transfer recovery, draft correction and idempotent finalization.
