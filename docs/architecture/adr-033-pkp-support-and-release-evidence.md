# ADR-033 — PKP support matrix and release evidence

Date: 2026-11-07. Status: proposed reconciliation for review; preserves the requested OJS/OMP -6 compatibility. Refines ADR-010/019 and C06–C09, D08, E02–E05.

## Decision

| Platform | Versions | Studio feature tier | Required release evidence |
| --- | --- | --- | --- |
| OJS | 3.5.0-4, 3.5.0-5, 3.5.0-6 | Stable acceptance scope | Separate same-SHA workflow/job/archive for each version, plus one owner manual gate per version. |
| OMP | 3.5.0-4, 3.5.0-5, 3.5.0-6 | Preview | All three declared same-SHA regression jobs/archives remain mandatory E02 evidence; no separate Stable OMP manual gate or Stable feature promise. |

Support maturity and the explicitly declared automated regression matrix are different contracts. Preview does not promise complete feature coverage, but does not waive a named E02 regression job. Missing, red, skipped, cancelled, stale or foreign-SHA evidence for any of the six targets blocks promotion. This explicitly reconciles the general ADR-019 Preview policy with the stricter, already implemented PKP matrix. Security, privacy and data-loss defects remain blockers for every tier. Keep all six existing jobs, assertions and artifacts; do not add `continue-on-error` or count an older green run.

`scripts/pkp-release-policy.mjs` owns the release target inventory used by E02 and the manual gate list. Regression tests compare it with the actual CI matrix and readiness markers, including -6. The PHP adapters still use their existing signed application protocols; PKP retains workflow/review/private-file authority. No API/schema, credential or database contract changes.

## Alternatives and consequences

Making all OMP jobs optional would weaken the already declared cross-version regression contract; promoting OMP to Stable would promise unproven feature coverage. Both are rejected. Keeping the old 13-gate inventory would let OJS -6 inherit manual approval from another version. The selected policy retains the stronger automated matrix and requires a fresh per-version attestation, at the cost of additional acceptance work. Merge approval accepts this support/evidence scope, not the release itself.

## Manual acceptance and compatibility

Add `ojs-3.5.0-6` beside `ojs-3.5.0-4` and `ojs-3.5.0-5`. The receipt retains the existing v1 envelope and now requires exactly **14** manual gates. New drafts leave every gate pending, including the new one. OJS -6 needs the same exact-candidate source SHA, real observation timestamp and redacted HTTPS acceptance reference as the older Stable targets; record the external plugin SHA and exercised scopes in the referenced evidence. CI success does not fill in an owner attestation.

Historical 13-gate drafts/receipts retain their original bytes, timestamps, subject and installer hashes. They remain evidence of the former scope and cannot authorize the expanded scope. Generate a fresh draft for the selected candidate and actual artifact bytes; do not append a fabricated PASS or transplant an old approval. No release tag, application version bump, production PKP upgrade or RC approval is made by this repair.

## Implementation and operational evidence

The -6 source/installation work was merged in Studio #877, OJS-plugin #34, OMP-plugin #26 and OMI #190. Main CI observations on 2026-11-07: [Studio six-target PKP workflow](https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/runs/42344206487), [OJS installation matrix](https://github.com/open-manuscript-initiative/omi-ojs-plugin/actions/runs/42344311652), [OMP installation matrix](https://github.com/open-manuscript-initiative/omi-omp-plugin/actions/runs/42344357858) succeeded for their own source commits. These observations are historical inputs, not evidence for a subsequent repair commit or deployed upgrade.

OMP -6 uses exact release source `9e2a7fd0054ca73e5f5a04c40fdcf9da2545dc6c`, recursive submodules and locked dependencies on the -5 PHP/Apache image; the application version is checked before tests. Its CI runtime is not advertised as an official OMP -6 image. Existing plugin release downloads are not silently retagged.

## Required review

Keep the five EN/HU architecture baselines, public integration pages and current RC instructions aligned. Tests must reject missing/pending/wrong-SHA OJS -6 acceptance, retain all six E02 job/archive requirements and generate an unapproved 14-gate draft. Existing installation, anonymity, access-control, writeback and native acceptance remain required; local contract tests do not replace them. Revisit on a version/tier change, a new manual gate or a distribution/support-scope change.
