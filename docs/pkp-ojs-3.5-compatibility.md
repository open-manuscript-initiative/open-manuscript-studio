# OMI Studio ↔ OJS 3.5 compatibility matrix

Status: Stable-baseline acceptance audit, 2026-09-20

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
| OJS 3.5 generic plugin integration | ✅ Stable baseline | OMI plugin registers PKP plugin API controllers and launch hooks. | Versioned CI must stay green on OJS 3.5.0-4 and 3.5.0-5. |
| Signed OJS → Studio launch | ✅ Stable baseline | HMAC-signed launch assertion with bounded lifetime. | Covered by both Stable OJS matrix targets. |
| Replay protection | ✅ Implemented | Studio persists launch nonces and rejects reuse. | Periodic cleanup of expired nonces must remain enabled. |
| Trusted remote URL / SSRF boundary | ✅ Implemented | Studio validates OJS API URLs against configured installations. | Regression tests for redirect, origin and malformed URL cases. |
| Role separation | ✅ Implemented | Editor, author and reviewer receive different scopes. | Maintain least-privilege scope review when adding endpoints. |
| Reviewer identity boundary | ✅ Stable baseline | Reviewer launch forbids contributor/editor identity and assignment-management scopes. | Covered by the disposable double-anonymous reviewer fixture on both Stable OJS targets. |
| Double-blind reviewer file access | ✅ Stable baseline | OJS filters file list and content through the concrete review assignment and native ReviewFilesDAO checks. | The Stable matrix proves both file enumeration and forbidden binary access. |
| Native OJS review forms | ✅ Implemented | Assigned OJS form is fetched and responses are returned to OJS through PKP review-assignment persistence. | Keep field-type compatibility tests. |
| Required review-form fields | ✅ Stable baseline | Studio validates before submission; OJS validates again before persistence. | The Stable matrix submits once with the required response missing and requires rejection before writeback. |
| Author-visible vs editor-only review-form fields | ✅ Implemented | OJS `included` semantics are preserved as author-visible metadata. | Confirm display semantics in a real author response flow. |
| Review-form localization | ✅ Implemented / pending merge | OJS-localized form strings and options are selected according to Studio UI locale with OJS fallback. | Merge and regression-test localization PRs. |
| Review comments | ✅ Stable baseline | Author+editor and editor-only comments remain separate in writeback. | PKP-side verification fails if editor-only text appears in the author-visible comment. |
| Reviewer recommendation | ✅ Stable baseline | Studio reads assignment-scoped OJS recommendation options and returns the unchanged external identifier; compatibility fallback remains isolated to older PKP APIs where needed. | PKP-side verification confirms that the selected OJS recommendation was persisted. |
| Reviewer revision editing | ⚠️ Preview extension | Studio stores an assignment-bound working revision snapshot and the Stable review-result path preserves comments/forms/recommendations. | Native OJS review-file upload remains outside the 1.0 Stable acceptance contract until separately evidenced. |
| Author revision editing | ⚠️ Preview extension | Author-specific launch/read scopes exist. | Native OJS revised-file upload remains outside the 1.0 Stable acceptance contract until separately evidenced. |
| Multiple review rounds | ⚠️ Preview extension | `reviewRound` is stored per assignment and round identity is retained in launch claims. | The dedicated two-round protocol remains required before multi-round behavior is promoted beyond Preview. |
| Editorial decisions | ✅ Correctly retained in OJS | Studio does not become the editorial decision authority. | Do not move accept/reject editorial decisions into Studio. |
| OJS notifications/email | ✅ Correctly retained in OJS | Studio does not replace OJS notification workflow. | Keep this boundary. |
| Publication artifact transfer | ✅ Implemented | Studio can transfer provenance-verified HTML, JATS, print PDF and interactive PDF to the current unpublished Production publication through OJS Integration 1.5.0.0. OJS independently verifies the publication-build digest and keeps the galley unapproved. | Complete a real OJS 3.5 Production-stage acceptance run for HTML/JATS/PDF. |
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

## Definition of OJS 1.0 Stable readiness

The Route A Stable baseline is defined by `docs/release/ojs-3.5-stable-acceptance.md`.
Both OJS 3.5.0-4 and 3.5.0-5 installation-level jobs must pass the same
stateful launch, anonymity, assignment-file, required-form and PKP-native
writeback checks. Features explicitly marked Preview above do not inherit the
Stable label and keep their own promotion gates.

For a broader PKP technical demonstration that includes multi-round review,
also run the protocol in `docs/pkp-ojs-two-round-e2e.md` and retain its
evidence.