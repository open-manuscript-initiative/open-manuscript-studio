# OJS 3.5 Stable acceptance contract

Status: Route A release gate
Target: Open Manuscript Studio 1.0
Accepted OJS targets: 3.5.0-4 and 3.5.0-5
OMP status: Preview

## Purpose

This document defines the installation-level evidence required before the OJS
connector may be treated as Stable for Open Manuscript Studio 1.0.

The Stable claim applies to the integration capabilities explicitly exercised
below. It does not promote every publication/export format or every optional
future OJS workflow extension to Stable. Format maturity continues to follow
the separate conformance and publication-release gates.

## Mandatory matrix

Both OJS jobs must pass against the matching plugin from its protected `main`
branch:

| Platform | PKP image | Release tier | Route A consequence |
| --- | --- | --- | --- |
| OJS | `pkpofficial/ojs:3_5_0-4` | Stable | Blocking |
| OJS | `pkpofficial/ojs:3_5_0-5` | Stable | Blocking |
| OMP | `pkpofficial/omp:3_5_0-4` | Preview | Compatibility evidence only |

OMP remains visibly labelled Preview even though it uses the same harness.
Privacy or data-loss defects found in Preview code still remain release
blockers under the general Route A blocker policy.

## Stable OJS acceptance checks

A matrix target is accepted only when the disposable installation and the real
Studio API complete the stateful workflow without retries.

The run proves all of the following:

1. OJS installs through native PKP tooling and the Studio integration plugin is
   registered without patching PKP core or writing PKP tables directly.
2. Capability discovery exposes the expected versioned
   `omi-integration/1/ojs` boundary.
3. Editor and author launches are HMAC-signed and receive distinct
   least-privilege scopes.
4. A reviewer launch is bound to exactly one reviewer, submission, review
   assignment and round.
5. Reviewer mode does not expose contributor identity scopes or author
   identity data.
6. Review file enumeration and binary access are independently constrained by
   the native OJS review assignment.
7. A launch assertion cannot be replayed after Studio has consumed it.
8. The imported review snapshot is article-only and remains marked
   `authorIdentity: hidden`.
9. A required native review-form field blocks submission while it is empty.
10. Native OJS reviewer recommendation options are read from OJS and the
    unchanged external identifier is returned on writeback.
11. Author-visible and editor-only reviewer comments remain distinct, and the
    PKP-side verification rejects any editor-only text that appears in the
    author-visible comment.
12. Review-form responses and the selected recommendation are verified through
    PKP-native repositories/DAOs after Studio writeback.
13. OJS remains authoritative for review assignment state, editorial decisions,
    notifications and publication state.

## Evidence artifact

After a successful workflow, the harness writes:

`tests/pkp-integration/runtime/acceptance-<platform>-<pkp-version>.json`

The artifact records:

- the exact Studio commit;
- the exact integration-plugin commit;
- the PKP target version;
- the declared release tier;
- the protocol profile; and
- the acceptance checks completed by the stateful run.

GitHub Actions retains the acceptance file together with the version-specific
fixture, PKP writeback verification, container logs, Playwright report, trace,
screenshots and video on failure.

The JSON is generated only after both the browser workflow and PKP-side
writeback verification succeed. It is evidence of the run, not a substitute
for the test itself.

## Stable boundary and excluded claims

The OJS Stable label does not automatically make the following Stable:

- JATS, HTML, EPUB, IDML or other output formats whose maturity is governed by
  their own conformance matrices;
- experimental or Preview publication-artifact paths;
- future native author-revision or multi-round conveniences not included in
  this acceptance contract;
- OMP, macOS or iOS support.

A capability outside this contract may still be available, but it must retain
its documented Preview or Experimental status until it receives its own
release evidence.

## Release rule

For `v1.0.0-rc.1` and `v1.0.0`, neither OJS Stable matrix target may be
waived because the other target is green. A regression in 3.5.0-4 or 3.5.0-5
reopens the OJS Stable gate.

The corresponding automation is
`.github/workflows/pkp-integration-environment.yml`.
