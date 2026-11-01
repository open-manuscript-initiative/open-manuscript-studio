# Studio 1.0 RC E02 — exact-commit cross-workflow evidence

**Status:** first executable E02 evidence aggregator; no RC tag, Stable claim or owner Go/No-Go.

The main Studio 1.0 Readiness job collects local tests, publication evidence, SBOMs and SHA-256 sums. It **does not** by itself prove that the external PKP, CodeQL, Android, desktop and conformance workflows succeeded for precisely the reviewed source commit. The manually dispatched `1.0 RC exact-commit evidence (E02)` workflow fills this gap without changing the established beta CI or automatically publishing releases.

## How to run a non-publishing RC dry-run

1. Select and record an immutable reviewed **main branch** 40-character commit SHA; avoid using a pull request's synthetic merge ref.
2. On that exact main commit, complete **all** named workflows: `OMI Studio CI/CD`, `1.0 Readiness`, `CodeQL`, `OMI-SPEC-320 conformance`, `PKP integration environment` with **both** OJS 3.5.0-4/5 Stable and OMP 3.5.0-4 Preview targets, and `Tauri Builds and Releases` for Windows, Linux, both macOS previews and Android. Where `paths` filters skip a workflow, dispatch that existing workflow manually on `main`; never count a different commit or a PR run.
3. Open GitHub Actions → **1.0 RC exact-commit evidence (E02)** → Run workflow; choose `main` and paste that identical commit SHA as `reviewed_sha`.
4. The workflow's job fails closed if the reviewed SHA does not equal its checkout/dispatch SHA or when any required workflow/job/archive is missing, red, skipped, cancelled, stale (over 14 days), or attached to a different commit. The latest matching attempt wins; a successful earlier run never hides a later failed run.
5. On success, a content-neutral `omi-rc-e02-<sha>-<attempt>` artifact contains `evidence.json` and `evidence.md` with each run ID/attempt, immutable GitHub archive SHA-256 digest, byte count, and status. Review this **alongside**, not instead of, the `1.0 Readiness` artifact's own `SHA256SUMS.txt` and source manifest.

The E02 report is a **candidate evidence inventory**, even when all six workflow classes pass. It does not modify tags, container images, installed client versions, PostgreSQL or any manuscript.

## Required evidence classes

| Workflow file | Required jobs/acceptance | Required SHA-256 GitHub archive |
|---|---|---|
| `ci.yml` | Build, collaboration demo, PostgreSQL integration gate | A successful build; other CI artifacts are not accepted as RC installers |
| `1.0-readiness.yml` | Build release evidence | `omi-1.0-readiness-<attempt>` |
| `codeql.yml` | At least one completed successful language analysis | None |
| `omi-spec-320-conformance.yml` | Completed `conformance` job | None |
| `pkp-integration-environment.yml` | OJS 3.5.0-4/5 Stable and OMP 3.5.0-4 Preview matrix; all required jobs succeeded | Three version/role-specific evidence archives tied to the run attempt |
| `tauri-desktop.yml` | Windows/Linux/macOS x2 desktop and Android APK builds | Five native binary archives |

A workflow must be a successful **push** or **workflow_dispatch** on the reviewed `main` commit, not merely a previously green pull request. Content-free failures remain in the Markdown report for traceability. All GitHub API calls are read-only and scoped by `actions: read`; no third-party service credentials are requested.

## What E02 does **not** establish yet

- A GitHub archive SHA-256 digest identifies its immutable zipped artifact **container**; it does not prove the cryptographic signature of the enclosed MSI/APK or independently calculate the constituent files' digests.
- The existing PKP E2E workflow checks out external OJS/OMP plugin `main` branches; it does not yet pin/report the plugin Git commit inside the acceptance artifact. Require separate pinned plugin evidence before treating this as reproducible multi-repository conformance.
- A green automation does **not** prove that the VPS really enforces #765 outbound network restrictions or #774 systemd PDF worker sandbox. Those open `release-blocker` tickets require redacted operator host tests.
- Linux `glib 0.18.5` in issue #271 remains an upstream exception; this gate does not mark RustSec fixed.
- No physical Android/Windows acceptance, production signing, trusted code-signing identity, accessibility assistive-technology review, external OMI normative validator or final release owner approval is inferred.
- The established [strict RC issue-label gate](../release/2026-11-01-route-a-audit.md) and exact SHA manual tag approval from PR #810 remain separately required. E02 is currently **not coupled to tag creation** until the external plugin/environment evidence and manual release policy are reviewed.

## Test and rollback

```bash
node --test tests/rc-evidence-aggregator.test.mjs
```

Regression tests cover valid exact-SHA aggregation, missing workflow evidence, PR/foreign branches, later red/cancelled runs, skipped PKP/Android targets, duplicates/expired/empty/unhashed archives, stale timestamps and rerun attempt artifact freshness.

**Rollback:** the E02 workflow can be disabled or the new script/test removed without changing the web/native applications, manuscript schemas, production API, regular beta build workflows, or existing release artifacts. This change intentionally creates no database or storage migrations.
