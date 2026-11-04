# RC1 operator observations — 4 November 2026

**Partial acceptance record; publication is not approved.**

Candidate source: `e1200268ad549c0a40ace8724715cd2405e9d03c`  
Native build: [41741830930](https://github.com/open-manuscript-initiative/open-manuscript-studio/actions/runs/41741830930)  
Operator: Varga István

- [Acceptance draft](./acceptance-draft.json): the existing v1 receipt, with the operator name and the supplied Windows, Android and Linux observation times filled in.
- [Operator observations in Hungarian](./operator-observations.hu.md): the supplied results, clarifications and remaining limits.

## Reported results

These are operator reports, not independent certification. The dated device installation observations are associated with the candidate discussed in the acceptance session; no additional device hash or deployment attestation was inferred.

| Area | Operator report | Scope and limits |
| --- | --- | --- |
| Windows | Installed and working; 4 November 2026 at 01:23 CET (`2026-11-04T00:23:00Z`) | Installer is not code-signed, as explicitly confirmed by the operator. |
| Android | Installed directly from APK and working; 4 November 2026 at 01:47 CET (`2026-11-04T00:47:00Z`) | APK signature check reported successful. No separate method, certificate identity or signature-check time supplied; no Play signing-lineage acceptance inferred. |
| Web | Working | Exact deployed identity and separate observation time not supplied. |
| OJS | 3.5.0-5 connection working | No manual 3.5.0-4 result, plugin commit, separate time or detailed operation list supplied. |
| OMP | 3.5.0-5 connection working | OMP remains Preview. |
| Document recovery | Restoring a document from backup succeeded | Does not demonstrate restoring the application version plus compatible DB/storage state. |
| Responsiveness | Tested on Windows, Android and web; manuscript produced a 46-page typeset PDF; immediate response without perceived delay | Qualitative report; no elapsed-time benchmark or PDF-export duration claimed. |
| Keyboard/mobile usability | Main functions reachable by keyboard on Windows; Android labels readable and buttons reachable | Limited declared observations, not full WCAG or screen-reader certification. |
| Native Linux | Tested from 4 November 2026 at 11:53 CET (`2026-11-04T10:53:00Z`); operator reports that everything works | Supersedes the earlier lack of a test environment. Start time only; distribution, package format/digest, detailed steps and completion time were not supplied. Linux remains Preview with the inherited GLib limitation. |

The supplied Windows, Android and Linux times have minute precision; seconds are represented as `00` in the receipt. The Linux timestamp is the start of testing, not its completion. Other observation times remain unspecified.

## Receipt and publication status

The original source SHA, native build ID, five workflow IDs and all seven installer hashes are unchanged. `reviewedAt` remains empty and all 13 full manual gates remain `pending`: successful functional observations are recorded without asserting the missing signature, channel, exact-version, host, recovery or owner acceptance.

The JSON is a working draft and must still fail the publication validator. It must not be supplied as an approved `release_evidence_json`. This documentation commit does not rebuild or reidentify the existing candidate, authorize a tag/release, close a blocker, waive a required gate or change platform support.

Follow [the final acceptance procedure](../../../2026-11-04-rc1-final-acceptance.md) to finish the actual receipt. The candidate-specific records in this directory retain the original build subject even after later documentation commits.
