# OMI-SPEC-180: Studio validation implementation profile

Status: **experimental implementation proposal**, 2026-10-31.
Ruleset: **studio-validation-0.1**. Report version: **0.1.0**.
Schema: `src/schemas/studio-validation-report-0.1.schema.json`.

OMI-SPEC-180 is Draft upstream; it has no frozen canonical report schema.
This implementation defines a local,
executable validation/report contract. Its check versions identify Studio adapters,
not versions of the related specifications. It does not add a fictitious 180 version
to `omi.specifications`, modify OMI-SPEC-320, or claim formal conformance.

## Author workflow

Open **Manuscript menu → Validation**, choose a profile, and run the checks.
The result includes error, warning and information counts, individual check states,
filterable diagnostics, rule codes and JSON-pointer locations. Where a diagnostic
resolves to an editor section, **Open section** navigates to it. The panel paginates
findings and works at desktop and mobile widths. Its interface is translated in the
nine primary PO catalogs; other locales use the existing supplemental English fallback.

The source manuscript remains editable. Running checks neither repairs the document
nor creates a checkpoint, changes history, contacts a server, or submits text to a
translation provider. There are no new authoring or export restrictions outside the
report panel. Existing format and publication release gates remain authoritative.

The engine captures a detached snapshot before its first asynchronous operation.
The report refers to the working state and its committed base `headRevisionId`;
it does not misrepresent pending edits as an immutable committed revision.
Changing the source or selected profile marks the displayed report stale and disables
its download until another run. The UI uses conservative constant-time reference
comparison during typing. API consumers can compare full state/history fingerprints
with `isValidationReportCurrent`. Neither method compares asset bytes a second time:
Missing manuscript/base identifiers are represented as `null` in the subject so
invalid IDs can themselves be described in an exportable report. Local payload
checks are observations at execution time and require a new run if
the asset repository changes.

## Profiles and coverage

Every profile has a fixed, versioned check manifest. Missing adapters, unknown
translation profiles and inaccessible asset stores never become successful checks.

| Check | Authoring | OMI exchange | Publication preflight |
| --- | --- | --- | --- |
| IDs, language and section hierarchy | Yes | Yes | Yes |
| Contributor, citation, annotation, bibliography, asset and object references | Yes | Yes | Yes |
| Notes, inline citation/xref anchors and named bookmarks | Yes | Yes | Yes |
| Linear revision history and available snapshot integrity evidence | Yes | Yes | Yes |
| Recognized Studio translation profile and source freshness | Yes | Yes | Yes |
| Canonical portable OMI schema and semantic serialization checks | — | Yes | Yes |
| Local asset presence, byte length and SHA-256 checksums | — | Yes | Yes |
| Active publication profile metadata and accessibility requirements | — | — | Yes |

Embedded section/block trees and the normal flat `parentSectionId` structure are
traversed. IDs and diagnostic targets remain original scholarly-object IDs.
The engine reports invalid relationships without removing or reconciling objects.
Bookmark and exact xref-kind checks supplement the legacy publication helper.
Plain annotation/note citation bibliography targets are checked; this is not a
complete validator for every experimental inline, layout or module extension.

An untitled draft can pass the authoring profile while failing portable exchange.
Unreviewed translations are informational; source divergence is a warning and does
not make the original manuscript unpublishable. Unsupported translation profiles
are preserved and disclosed as uninspected. Missing revision digests make integrity
coverage incomplete, rather than inventing earlier integrity evidence. A declared
shallow history is disclosed; the history check covers the supplied revisions only.

The browser supplies `getAssetPayload` from the local asset repository. Programmatic
callers pass `loadAsset`; without a reader, manuscripts with declared assets receive
an incomplete result. A reader failure is an execution error; an absent or corrupt
payload is a document error. No external URL is fetched automatically.

## Report contract

Reports are standalone JSON artifacts, outside manuscript state. This avoids changing
the manuscript digest by storing the report about that digest. Importing a report
does not import its source manuscript, modify content, or grant permissions.

| Member | Meaning |
| --- | --- |
| `$schema`, `format`, `version`, `ruleset` | Exact local report and adapter contract |
| `relatedSpecification`, `experimental` | Relationship to planned OMI-SPEC-180, with explicit experimental status |
| `id`, `createdAt`, `profile` | Report identity, timestamp and selected check manifest |
| `subject` | Manuscript ID, committed base ID, working-state digest and envelope/history evidence digest |
| `checks[]` | Adapter ID/version, pass/fail/skipped/error state, completeness, truncation and diagnostic references |
| `diagnostics[]` | Unique diagnostic ID, check ID, stable code, severity, RFC 6901 pointer and optional target/related ID |
| `summary` | Outcome, coverage completeness and counts of retained diagnostics |
| `exclusions[]` | Fixed boundaries: external links, scholarly accuracy, artifact rendering/DTD and authentication |

`valid` means all selected checks completed without error-level document findings.
Warnings and information can coexist with `valid`. `invalid` means at least one
adapter found an error. `indeterminate` means no known document error was found,
but coverage could not be completed. `summary.complete` is independent of outcome:
an invalid report may also be incomplete. Execution exceptions are sanitized and
reported as unavailable checks; remaining adapters still run.

Each adapter retains at most 200 diagnostics. Truncation makes coverage incomplete;
the original failure state is retained even if a later error was outside the retained
window. Counts describe retained diagnostics, not an invented total for omitted ones.
The UI shows localized explanations. The JSON contains machine codes and locations,
without manuscript text, translator notes, provider credentials or exception messages.

`parseValidationReport` and `serializeValidationReport` enforce both the JSON schema
and semantic consistency: fixed profile coverage, unique diagnostic IDs, check links,
status/error consistency, summary counts and scope exclusions. Reports are unsigned
observations, not authenticity, authorization, peer-review or publication certificates.

## Boundaries and future work

This validates an already loaded Studio manuscript. Raw files must first pass their
existing parser/schema boundary. Unfingerprintable/cyclic JavaScript objects cannot
produce a meaningful source-bound report and the caller receives a failure.
The exchange adapter currently exposes a single portability diagnostic when the
existing strict serializer rejects a document; it does not pretend to enumerate all
schema violations. Other adapters still provide precise independent locations.

The publication profile is a local preflight. Actual JATS DTD/JATS4R validation,
renderer fidelity, PDF layout, publication signatures, network availability and
academic correctness are outside this report. Their existing release gates are not
bypassed. Canonical 180 specification governance, cross-implementation conformance,
signed reports, externally registered rule packages, complete extension validation
and automatic remediation remain separate work.

## Executable requirement mapping

These identifiers describe the local implementation, not upstream normative REQs.

| Local requirement | Evidence |
| --- | --- |
| VAL-01: explicit profile, adapter versions and coverage | `validation.ts`, profile/coverage tests |
| VAL-02: diagnostic severity, codes, pointers and scholarly targets | `manuscriptValidation.ts`, graph/anchor tests |
| VAL-03: independent validity and completeness | Missing-digest, future-profile and execution-failure tests |
| VAL-04: immutable capture and working-state/history binding | Snapshot/staleness/tampering tests |
| VAL-05: preserve source editing and existing release boundaries | Pure adapters, UI state tests, no store mutations |
| VAL-06: local asset byte integrity | Missing/corrupt/unavailable payload tests |
| VAL-07: portable machine-readable reports | Report JSON schema, parser/serializer and report fixtures |
| VAL-08: reject fabricated coverage and inconsistent summaries | Negative report tests and rejected fixture |
| VAL-09: bounded diagnostics and safe exception handling | Truncation and sanitized execution tests |
| VAL-10: responsive, localized author interface | Nine PO catalogs and Playwright desktop/mobile scenarios |

Fixtures under `tests/fixtures/validation` include a valid authoring report, a valid
report describing an invalid document, an incomplete asset report, and a malformed
report rejected because a required check is missing.

Run `npm run test:validation-model`, `npm run i18n:validate-json`,
`npm run i18n:po:audit`, `npm run lint`, `npm test`, `npm run build`, and
`npx playwright test e2e/validation-model.spec.ts --project=desktop-chromium`.
