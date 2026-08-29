# OMI Studio ↔ OJS 3.5 compatibility matrix

Status: implementation audit, 2026-08-29

This document records the integration boundary between Open Manuscript Studio and Open Journal Systems (OJS) 3.5. It is an engineering compatibility matrix, not a claim of PKP certification. OJS remains the workflow and authorization authority; Studio acts as a specialized scholarly document editing and review client.

## Architectural rule

The integration MUST preserve OJS as the system of record for:

- journal/context configuration;
- submission and workflow stage;
- reviewer assignment and review round;
- reviewer identity and review access policy;
- assignment-scoped review files;
- review-form definition and review-form responses;
- reviewer recommendation identifiers;
- editorial decisions;
- notifications and email workflow;
- publication state.

Studio MAY cache assignment-bound data required for editing, but MUST NOT invent OJS identities, workflow states, form fields, recommendation identifiers, or access rights.

## Compatibility matrix

| Area | Status | Current implementation | Remaining acceptance condition |
| --- | --- | --- | --- |
| OJS 3.5 generic plugin integration | ✅ Implemented | OMI plugin registers PKP plugin API controllers and launch hooks. | Keep CI against supported PHP/OJS 3.5 combinations. |
| Signed OJS → Studio launch | ✅ Implemented | HMAC-signed launch assertion with bounded lifetime. | Regression test on supported OJS 3.5 releases. |
| Replay protection | ✅ Implemented | Studio persists launch nonces and rejects reuse. | Periodic cleanup of expired nonces must remain enabled. |
| Trusted remote URL / SSRF boundary | ✅ Implemented | Studio validates OJS API URLs against configured installations. | Regression tests for redirect, origin and malformed URL cases. |
| Role separation | ✅ Implemented | Editor, author and reviewer receive different scopes. | Maintain least-privilege scope review when adding endpoints. |
| Reviewer identity boundary | ✅ Implemented | Reviewer launch forbids contributor/editor identity and assignment-management scopes. | Two-account double-blind regression test. |
| Double-blind reviewer file access | ✅ Implemented | OJS filters file list and content through the concrete review assignment and native ReviewFilesDAO checks. | Two-account double-blind regression test. |
| Native OJS review forms | ✅ Implemented | Assigned OJS form is fetched and responses are returned to OJS through PKP review-assignment persistence. | Keep field-type compatibility tests. |
| Required review-form fields | ✅ Implemented | Studio validates before submission; OJS validates again before persistence. | Negative E2E test with missing required field. |
| Author-visible vs editor-only review-form fields | ✅ Implemented | OJS `included` semantics are preserved as author-visible metadata. | Confirm display semantics in a real author response flow. |
| Review-form localization | ✅ Implemented / pending merge | OJS-localized form strings and options are selected according to Studio UI locale with OJS fallback. | Merge and regression-test localization PRs. |
| Review comments | ✅ Implemented | Author+editor and editor-only comments remain separate in writeback. | Verify author never receives editor-only text. |
| Reviewer recommendation | ⚠️ Partial | Studio currently uses an internal ACCEPT/MINOR_REVISION/MAJOR_REVISION/REJECT enum and legacy string writeback. | Read native OJS recommendation options/IDs from the assignment and persist the selected native ID. |
| Reviewer revision editing | ⚠️ Partial | Studio stores an assignment-bound working revision snapshot. | Add native OJS review-file upload/writeback tied to the review assignment/round. |
| Author revision editing | ⚠️ Partial | Author-specific write scopes exist. | Add native OJS revised-file upload to the correct review workflow/round. |
| Multiple review rounds | ⚠️ Partially modeled | `reviewRound` is stored per assignment. | Complete two-round E2E test and ensure files/forms/comments/recommendations never cross rounds. |
| Editorial decisions | ✅ Correctly retained in OJS | Studio does not become the editorial decision authority. | Do not move accept/reject editorial decisions into Studio. |
| OJS notifications/email | ✅ Correctly retained in OJS | Studio does not replace OJS notification workflow. | Keep this boundary. |
| Publication workflow | ✅ Correctly retained in OJS | OJS remains publication system of record. | Keep this boundary. |

## Security invariants

Reviewer mode MUST satisfy all of the following:

1. A launch identifies exactly one reviewer, submission and review assignment.
2. The assignment belongs to the signed reviewer and submission and is neither cancelled nor declined.
3. Generic contributor identity scopes are unavailable to reviewer mode.
4. File enumeration and binary download are both independently checked against the review assignment.
5. Review-form access is tied to the same review assignment.
6. Writeback is authenticated server-to-server and does not trust browser-provided OJS credentials.
7. OJS validates every foreign identifier before persistence.
8. Studio must never infer a native OJS recommendation ID from an internal enum.

## Native recommendation contract

The next compatibility increment MUST treat OJS recommendation IDs exactly like review-form option IDs: OJS supplies the available options for the concrete assignment, Studio displays those labels, and Studio returns the unchanged OJS identifier.

Proposed response shape:

```json
{
  "submissionExternalId": "123",
  "reviewAssignmentExternalId": "456",
  "selectedExternalId": "12",
  "recommendations": [
    { "externalId": "12", "label": "Accept Submission" }
  ]
}
```

The OJS plugin must obtain these values from `Repo::reviewerRecommendation()->getRecommendationOptions($context, $reviewAssignment)`. On writeback it must validate the identifier against the journal/context and persist it on the native `ReviewAssignment`, rather than encoding a recommendation in a comment.

## Features intentionally outside Studio authority

The following are not compatibility gaps and should remain in OJS: reviewer assignment creation, review-round creation, disclosure/blinding policy, reviewer identity resolution, editorial decisions, production/publication scheduling, notification templates, and journal workflow configuration.

## Definition of PKP/OJS integration readiness

The integration is ready for a PKP technical demonstration when all ✅ items remain green and the three ⚠️ workflow items above have been completed or are explicitly presented as bounded future work. Before that demonstration, run the two-round E2E protocol in `docs/pkp-ojs-two-round-e2e.md` and retain the test evidence.