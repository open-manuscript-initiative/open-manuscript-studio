# OJS / OMP 3.5.0-6 compatibility review

Reviewed: 2026-11-07. Compared the actual -5 and -6 source snapshots, including
the shared PKP submodule. This records integration engineering, not PKP certification.

## Exact upstream sources

| Source | 3.5.0-5 | 3.5.0-6 |
| --- | --- | --- |
| OJS | `372e3b84740344db6c2f85193c3eb3e4f539cb00` | `0f2de4ff3f399a65dbe5c24c035529c0ff9bc976` |
| OMP | official `3_5_0-5` tag | `9e2a7fd0054ca73e5f5a04c40fdcf9da2545dc6c` |
| Shared `lib/pkp` in both applications | `8b5f0fdc8d5664000b8652002781a14bd406bf21` | `c4c0aa8c5293254ad253544aea230b1b607d5249` |

Both -6 `dbscripts/xml/version.xml` files identify `3.5.0.6` and date the
source release 2026-10-31. The OJS download page announces availability on
2026-11-01. The OMP download landing page still advertised -5 when checked;
its official -6 Git tag and version metadata are already present.

Primary sources:

- [OJS -6 notes](https://github.com/pkp/ojs/blob/3_5_0-6/docs/release-notes/README-3.5.0)
- [OMP -6 notes](https://github.com/pkp/omp/blob/3_5_0-6/docs/release-notes/README-3.5.0)
- [OJS source comparison](https://github.com/pkp/ojs/compare/3_5_0-5...3_5_0-6)
- [OMP source comparison](https://github.com/pkp/omp/compare/3_5_0-5...3_5_0-6)
- [Shared PKP comparison](https://github.com/pkp/pkp-lib/compare/8b5f0fdc8d5664000b8652002781a14bd406bf21...c4c0aa8c5293254ad253544aea230b1b607d5249)

## Changes that matter to OMI

| Upstream change | Integration consequence |
| --- | --- |
| Consistent submission-API anonymization (#13154); protected schema mapper parameters change from a bool/collection to explicit review/submission ID arrays | OMI adapters read authorized repository objects into their own projections; they neither subclass these protected mappers nor pass their old named arguments. Repeat anonymous-review/identity-isolation E2E on -6. |
| Stricter user/contributor API `writeOnly`/`apiSummary` handling (#13442), context/user/file ownership checks and library-file access policies | Keep least-privilege, submission/context/assignment-bound access and direct binary-download negative tests. Do not fall back to wider PKP endpoints to recover hidden fields. |
| ORCID authorization, email variables, redirect settings, invitation handling and publication warnings (#13283/#13517) | PKP retains its ORCID settings and authority; Studio login credentials stay separate. An unverified ORCID must never be presented by OMI as an authenticated identifier. |
| ROR trust-boundary and affiliation migration fixes (#13018/#13274) | Preserve repository-supplied localized affiliations/ROR IDs; do not infer extra affiliations from free text. |
| Native XML import extension restrictions (#13030), escaping/type validation, review-export access restrictions and parent-ID checks | OMI's existing constrained file format/identity checks remain mandatory. This is not a reason to relax rejection or file-stage policies. |
| OJS versioned galley files are copied into distinct submission-file records | Re-read current publication/galley IDs; preserve publication-bound artifact receipts and idempotent writeback. |
| OMP chapter-author cloning fixes (#13036) | Keep chapter identity and contributor associations authoritative in OMP; repeat the single-chapter reviewer projection tests. |
| Email URL/template fixes, scheduler/session fixes, OAI metadata corrections, accessibility/localization updates | Host maintenance improvements. OMI does not replace the PKP scheduler, sessions, email templates, OAI endpoints or masthead. |
| Editorial masthead display/history can be configured (#13370) | Relevant to journal administration, including Egyháztörténeti Szemle, but outside the OMI connector. |

The release notes' configuration section is cumulative for the 3.5 series;
not every listed setting is newly introduced between -5 and -6. The root
configuration templates have no -5 → -6 diff in these source tags.

No adapter API rewrite was identified as necessary from the reviewed source
contracts. The new targets must still pass real installation/workflow tests;
source inspection is not a substitute for those results.

## Compatibility extension

- Plugin CI: retain -4/-5 and add -6 in both integration repositories; assert
  that the checked-out application's version matches the requested tag.
- Studio workflow matrix: OJS -4/-5/-6 at the existing Stable acceptance tier;
  OMP -4/-5/-6 remains Preview.
- Default local environment: -6; explicitly selected older targets still work.
- E02: require every selected version-specific job and its attempt-bound
  diagnostic artifact. Missing/skipped -6 evidence is rejected.
- OMP's absent Docker tag is handled by an exact -6 source build on the
  official -5 PHP/Apache runtime, with recursive submodules and locked Composer
  dependencies, followed by an actual-version check. The runtime image is not
  misrepresented as an OMP -6 application.
- Existing signed/pending RC1 receipts remain historical evidence for their
  original candidate and manual gate IDs; they are not automatically approved.

No production PKP upgrade, plugin release tag or installer publication is
performed by this compatibility change. PHP/Docker integration runs execute in
GitHub CI; this workspace has neither PHP nor Docker installed.


## Release-policy reconciliation — 2026-11-07

[ADR-033](architecture/adr-033-pkp-support-and-release-evidence.md) retains all six automated targets as mandatory E02 regression evidence, keeps OMP Preview, and adds `ojs-3.5.0-6` as the fourteenth manual gate. Original 13-gate receipts remain historical; prepare a new unapproved draft for the selected candidate rather than rewriting them.
