# Studio 1.0 Route A — readiness review, 2026-11-01

> Proposed additional guard: [exact-candidate evidence](rc-evidence.md) binds the reviewed prior build, actual artifact hashes, same-SHA workflow results and manual acceptance receipt before 1.0 tagging. Existing blockers remain unresolved until real evidence is supplied.

**Review scope:** [#390](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390), current `main` source, release scope and blocker policy, merged PR/CI evidence and current GitHub issues. This is an evidence inventory, **not** approval to publish `v1.0.0-rc.1` or `v1.0.0`.

## 1. What is technically complete

- The automated implementation milestones already checked in #390 (progressive long-manuscript editing, OMI format conformance, real-world import/edit/save/reopen/export, OJS Stable connector acceptance, security/accessibility/recovery/update/installer regression suites) are present. A green PR job means those **automated paths** passed on its commit, not that the entire live installation was independently audited.
- PR #808 completed restrictive Tauri CSP and EuroOffice WebView separation. The maintainer confirmed the installed tester version works. #770 is closed.
- PR #809 added the Rust GTK3 `glib` advisory tracker; all seven PR checks were green and it was merged. The affected Linux dependency is **still `glib 0.18.5`** and issue #271 remains open. No silent dismissal.
- PRs #802/#804/#805/#806 improved media integrity, portable cloud backup restore and mobile manuscript tabs. The maintainer confirmed practical cross-device cloud-package opening and mobile operation. This does not prove automatic background asset hydration, sync or every offline conflict path.

## 2. Real RC/1.0 decision gates

| Area | As of 2026-11-01 | RC action and minimum evidence |
| --- | --- | --- |
| Production API outbound restrictions [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765) | **BLOCKED — host acceptance not documented.** Issue reopened because a closed GitHub issue alone is not a verified deployed egress policy. | Verify effective IPv4/IPv6 and DNS rebinding protection at **connection time**, including loopback, RFC1918, link-local and metadata addresses. Confirm approved WebDAV/remote services still work. Store redacted host tests. |
| PDF worker sandbox [#774](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774) | **BLOCKED — code/units staged; live socket, service and resource sandbox not confirmed.** | Demonstrate actual systemd unit and Unix socket, `PrivateNetwork`, cgroups, non-root identity, no secrets, malicious/malformed PDF denial, bounded jobs, legitimate fonts and render/import, and fail-closed `PDF_WORKER_REQUIRED` behavior on the VPS. |
| Upstream Linux GLib [#271](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271) | **EXTERNAL DEPENDENCY — unresolved, documented.** Tauri GTK3 path retains Rust `glib 0.18.5`. | Prefer upstream GTK4/WebKitGTK6 stable migration. Until then, the accepted exception requires an explicit owner, review date, no known reachable application path, mitigations, and public disclosure per [blocker policy](1.0-blocker-policy.md). Do not label the advisory patched. If an exception cannot be supported, delay or downgrade the Linux Stable claim. |
| Real manuscripts and preservation | **MANUAL ACCEPTANCE NOT RECORDED for RC SHA.** | A private 30-minute editing session on Windows and Android covering free deletion/editing of all text, large DOCX, notes, tables, images, citations, tab switching, cloud/open, offline recovery, save/close/reopen, OMI/DOCX/ODT/PDF export. Log only anonymized pass/fail evidence, not manuscript content. |
| Stable platforms | **BUILD GATES PRESENT; RC physical evidence outstanding.** | Windows 11 installer/update/rollback and Android signed update on recorded devices, Linux x64 native package and PDF/EuroOffice rendering; current and previous Chrome/Edge plus current Firefox critical path. Confirm versionCode and signed artifact checksums. |
| Publisher integrations | **Automated OJS 3.5.0-4/5 acceptance available; RC environment sign-off outstanding.** | Verify OJS credential scopes, anonymous reviewer identity, authoritative editor decision and exact revision/provenance for same SHA; maintain OMP/macOS Preview and iOS Experimental labels. |
| Release operations | **RC tag and freeze not started.** | Final beta.13 signed release decision (beta.13 source is not a public release), RC1 feature freeze, 2–4 weeks of observation, artifact/SBOM/SHA256 provenance, branch-protection decision and explicit owner Go/No-Go. |

**Accepted Route A supported Stable scope:** Web, Windows 11 x64, Ubuntu 22.04/24.04 x64, Android 10+, OJS 3.5.0-4/5. OMP 3.5.x and macOS remain Preview; iOS/iPadOS remains Experimental. Changing any Stable claim is an explicit owner release-scope decision, not an automated workaround.

## 3. Why a green 1.0 Readiness workflow is not an RC approval

Before this review, the workflow ran `release:readiness --strict-local --github`. The script reports `github.blockers` and `github.passed`, but **only exited with error for failing local gates**. Consequently it could remain green even when `release-blocker` issues were open. The minimumScore field also did not represent independent device acceptance.

The accompanying fix introduces an **opt-in** `--strict-release` mode, exposed by the manual `1.0 Readiness` workflow dispatch `strict_release` boolean. It fails closed when GitHub evidence cannot be fetched or required labels are missing, and it fails while any open `release-blocker` exists. Ordinary PR/beta CI keeps `--strict-local` and may pass with warnings; the strict RC check must be run separately before owner approval. **Even a successful strict RC run does not satisfy physical-device, host-security or Go/No-Go manual gates.**

The GitHub Release workflow also contained an automatic publication path for every new version tag on `main`. For the `1.0.0-rc.N` and `1.0.0` versions this could bypass the owner Go/No-Go. The accompanying change keeps automatic publishing for ordinary beta versions but requires **manual workflow dispatch**, the explicit `APPROVE_1_0_RELEASE` approval phrase, exact `release_reviewed_sha` equal to the build commit, and a passing strict readiness check **before the tag is created**. This is an operational safeguard, not a replacement for genuine owner/device sign-off.

The #765 and #774 tickets carry `release-blocker` + `manual-test` labels. #271 carries `external-dependency`. #390 carries `rc-required` + `manual-test`. The two production security issues must **not** be closed by CI alone; attach redacted, dated, commit-associated evidence from the real Plesk server.

## 4. Proposed sequence and dates

1. Verify host-level PDF sandbox and outbound policy (#774 and #765), with rollback and positive/negative tests. Do not weaken network isolation to bypass a broken PDF.
2. Reconcile visible Dependabot/security alerts against current lockfiles and reachability; no unsupported all-clear claims. Resolve any reachable Critical/High findings before RC.
3. Record exact Windows build/CPU/RAM, preserve the already recorded Android reference, and perform the 30-minute private-manuscript acceptance sessions. Confirm OJS Stable on both declared versions.
4. Separately approve and publish the `0.3.0-beta.13` signed artifacts if the beta release checklist passes. Source version alone does not mean installed native builds are current.
5. Once the mandatory gates are clear, tag the exact reviewed `v1.0.0-rc.1` commit, enable the feature freeze and run the **strict** RC readiness workflow. Keep hashes, release assets and test logs linked to that exact SHA.
6. Run a measured 2–4 week RC observation window with no unresolved P0/P1 or failed Stable gate. The **2026-11-09 to 2026-12-06** period is provisional and should be moved if the RC prerequisites are late; a date never overrides a red gate.
7. Record the final owner Go/No-Go, release scope (including the Linux GLib exception decision), release signatures, distribution and rollback paths before publishing `v1.0.0`.

**No RC or 1.0 tag was created as part of this review.** All of the above remains subject to the existing [1.0 blocker policy](1.0-blocker-policy.md) and [Route A scope](1.0-scope.md).
