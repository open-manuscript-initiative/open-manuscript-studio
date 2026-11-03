# RC1 final acceptance: one candidate, one receipt

Prepared 4 November 2026. This procedure and its generated draft do not approve
or publish RC1. The real device observations and release-owner decision remain
required. Existing successful observations can be reused when their source,
artifact and relevant code delta are demonstrably covered.

## 1. Finish the automated evidence collection

After the preparation PR is merged, select the **new merged main SHA**, rather
than a PR SHA or an older green commit. The ordinary 1.0 main push is now a
build-only native candidate; reuse its successful artifacts. A separate
`candidate_only=true` dispatch is needed only when the desired build is absent.

Wait for CI/CD, CodeQL, Readiness, SPEC-320, the PKP matrix and all required
Tauri jobs to finish successfully on that SHA. Open GitHub Actions →
**1.0 RC exact-commit evidence (E02)** → Run workflow on **main** and enter
that same full SHA as `reviewed_sha`. It verifies the checked-out source,
selects the newest same-SHA workflow attempts and downloads the selected native
build only. Older green attempts cannot hide newer red attempts.

The `omi-rc-e02-<sha>-<attempt>` artifact includes:

| File | Meaning |
| --- | --- |
| `evidence.json` / `evidence.md` | Exact-SHA workflow, mandatory-job and immutable archive evidence |
| `SHA256SUMS.txt` | Actual SHA-256 of all seven installer files under publication's stable filenames |
| `acceptance-draft.json` | Existing v1 receipt with exact SHA, build/workflow IDs and installer hashes; all 13 owner gates pending |
| `acceptance-next-steps.md` | Candidate build link and outstanding manual gates |

The hash preparation and publication use the **same staging implementation**.
Missing, ambiguous, empty or non-regular installers fail preparation. Download
the actual installers from the linked native build run, preserve their bytes,
and compare them to the manifest. Do not replace them with a later rebuild.
The evidence artifact contains hashes and the draft, not another copy of the
installers. Archive digests and installer hashes are distinct; neither proves
a signing authority or an installed application's behavior.

## 2. Complete only the missing actual platform acceptance

Use synthetic documents and disposable test profiles/VMs. Keep the real
manuscript and credentials out of GitHub and CI artifacts.

| Target | Signature / identity | Update and recovery observation |
| --- | --- | --- |
| Windows 11 | Check MSI/NSIS hash, package identity and Authenticode result; for the Tauri updater channel, separately verify the configured trusted public key and signed update metadata/artifact. Record `NotSigned` honestly if returned. | Install and launch; upgrade through the actual approved channel; reopen synthetic OMI content. Restore an approved previous package **and compatible state backup/VM snapshot**, then compare content/revisions/notes. |
| Android / Play | Verify APK with `apksigner verify --verbose --print-certs`; verify package, versionCode and certificate against the selected direct-install or Play signing lineage. A direct APK is not automatically interchangeable with a Play-signed package. | Upgrade the reference phone on its actual channel; reopen test content. Prove backup/reinstall/restore on disposable data. Ordinary Android in-place downgrade is generally rejected; do not call it a tested rollback. |
| Linux native Preview | Verify DEB/AppImage hashes and trusted origin; record the inherited `glib 0.18.5` limitation and the approved Preview scope. Keep all Linux build/installer and `linux-device` gates. | In disposable Ubuntu, launch/edit/save/reopen; verify update and restore prior trusted package plus compatible state. CI package installation alone is not a device observation. |
| Web/API | Bind deployed source and API/web image digests or equivalent deployment identity. A mutable image tag is insufficient. | In isolated staging, restore the previous application **and compatible DB/storage snapshot**. Do not test destructive rollback on the production VPS. |
| OJS | Record each actual plugin commit and target OJS version; both 3.5.0-4 and 3.5.0-5 are required. | Reuse exact-candidate PKP evidence where valid; cover authorized transfer, revision/provenance and privacy, plus isolated restoration. OMP stays Preview. |

The native workflow currently always signs/verifies its release Android APK,
but a successful APK signature check does not establish Play channel lineage.
Similarly, package hashes do not establish desktop updater signatures.
An absent or invalid required signature is an outstanding gate, not automatic
PASS. Select a supported distribution channel and retain its actual evidence.

## 3. Complete the existing receipt, without inventing observations

The generated `acceptance-draft.json` uses `omi-studio-rc-evidence` **version 1**,
not a new approval format. Retain the generated subject, workflow IDs and all
seven artifact hashes. The release owner fills in their identity and actual
UTC review time, then reviews each required gate:

| Gate | Evidence to link |
| --- | --- |
| `host-egress` | Actual deployed API network-denial/positive-flow/bypass and persistence/recovery acceptance. #765 is closed, but closure alone is not this receipt. |
| `host-pdf-sandbox` | Actual isolated worker host acceptance, reusing the earlier successful observations where applicable. |
| `private-manuscript-preservation` | Private local import/edit/save/reopen/export observations; publish only redacted counts/digests. |
| `windows-device` | Exact installer identity, actual reference-device acceptance and upgrade result. |
| `linux-device` | Actual Preview device/package behavior and explicitly disclosed GLib limitation. |
| `android-device` | Reference-phone identity, real update channel, signing lineage and document preservation. |
| `ojs-3.5.0-4` | Exact-candidate integration evidence for this version. |
| `ojs-3.5.0-5` | Exact-candidate integration evidence for this version. |
| `security-review` | Actual security review including unresolved #271 and the approved Linux Preview distribution scope. |
| `accessibility` | Declared desktop/mobile accessibility observations plus linked automated evidence. |
| `performance` | Reference-device measurements and validation/large-document responsiveness observations. |
| `recovery` | Observed package/application and compatible state recovery; name the covered platforms and limits. |
| `owner-go-no-go` | Final explicit owner decision on the exact candidate and distribution scope. |

Each actual pass needs the same `sourceSha`, an honest `observedAt` UTC time,
and an HTTPS reference to a suitably redacted acceptance record. Pending/fail
entries stay pending/fail until the observation exists. Local private notes
must not be uploaded simply to obtain a public link. The unchanged publication
validator rejects incomplete gates, wrong subjects, missing workflows or hashes.

## 4. Resolve tracker scope and publish only after actual GO

#390 combines pre-RC approval and post-RC observations. Before closing its
`rc-required` work, record the completed pre-RC receipt explicitly and retain
the planned **2–4 weeks after RC publication** as separate open follow-up work.
Do not mark the future observation period complete or merely remove a label
to satisfy a gate. Keep #271 open while the vulnerable dependency remains.

After all actual checks and the owner decision pass, dispatch **Tauri Builds
and Releases** on that reviewed main SHA with:

- `release_tag`: `v1.0.0-rc.1`
- `release_reviewed_sha`: exact reviewed main SHA
- `release_build_run_id`: the approved native run from the generated receipt
- `release_evidence_json`: the completed actual receipt
- `release_approval`: the documented `APPROVE_1_0_RELEASE` phrase, entered
  only after the real owner GO

The publication job downloads the approved prior artifacts, recomputes hashes,
rechecks newest same-SHA E02 and strict blockers before tagging, and preserves
the RC prerelease status. The workflow's fresh builds do not replace the
approved prior installer bytes. Do not advance the website's release/download
claims before the immutable release exists. Stable `v1.0.0` remains a separate
later decision after the RC observations.
