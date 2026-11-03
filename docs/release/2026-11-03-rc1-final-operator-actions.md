# OMI Studio v1.0.0-rc.1 — last-gate operator action pack

> **State: PREPARED / NO-GO. 2026-11-03, Europe/Budapest.**
> This is an evidence-collection procedure and decision sheet, **not** a
> finished receipt or an authorization to tag/release. Use the existing
> [dated acceptance record](./2026-11-03-rc1-acceptance-record.md), strict
> gate [#390](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390),
> [E02](./rc-e02-evidence.md), and [RC evidence contract](./rc-evidence.md).
> **Do not repeat already passed tests without a relevant source/build delta.**

## 0. Release candidate identity — freeze only after open blockers are resolved

- Reviewed main snapshot as this packet was drafted:
  \`9613dc015ee219b1bebf6d74e19d59421f67038f\` (#845 merge).
- Candidate main SHA: **UNSELECTED**.
- \`v1.0.0-rc.1\` tag: **NOT CREATED**.
- Do not use the current snapshot SHA as an automatically approved release SHA.
- Latest snapshot CI showed CodeQL, OMI-SPEC-320, ordinary Readiness and
  Tauri build **SUCCESS**; CI/CD still **IN PROGRESS**. No strict RC/E02
  signature or candidate-only artifact gate was proven at that time.
- [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765)
  remains the open \`release-blocker\`. [#271](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271)
  is a separate upstream risk; [#390](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390)
  remains \`rc-required\`, even though it also contains **post-RC** tasks.
  Governance must split the RC-only approval from post-release observation
  rather than silently remove \`rc-required\` to satisfy the automated gate.

## 1. #765 — close only the actual production-egress evidence gap

Use the [current shared-Plesk-UID acceptance worksheet](../../deployment/egress/acceptance-TEMPLATE.md)
and the [existing live host runbook](../server/765-774-live-host-acceptance.md).

**Already accepted as concrete technical observations (do not rerun):**
API in its intended cgroup; attached ingress/egress BPF; eight
SSRF/rebinding regression tests; **BASELINE + FILTERED** positive/negative
IPv4/IPv6 socket canaries in *separate* systemd cgroups with real kernel
filtering. The separate cgroup result does **not** cover the live API's own
sockets.

**Only missing acceptance evidence:** exact deployed API/candidate mapping,
controlled actual API-cgroup connection-path denial and live positive flows
(PostgreSQL/proxy/collaboration, enabled OJS/OMP/OIDC/ORCID, cloud/WebDAV,
Office, mail), DNS rebinding/redirect/localhost/proxy escape review and
boot persistence/rollback. Use provider workflows already observed by the
owner when they match the candidate and service; record gaps explicitly.
Never apply the UID-wide nftables rules on the shared Plesk account, hang
production, probe unapproved cloud metadata, or copy secrets to GitHub.

**Owner result:** NOT VERIFIED · final \`host-egress\` receipt: **PENDING**.
If some actual live-cgroup or helper-path coverage cannot be proven safely,
keep #765 open and **NO-GO**; do not lower a mandatory security requirement
because repeated canaries were green.

## 2. #271 — Linux native upstream risk: one explicit decision

Read [#271 RC1 security worksheet](../security/271-rc1-glib-risk-decision.md)
alongside the repository's existing
[glib risk tracker](../security/tauri-glib-advisory-271.md).

The fixed Rust crate exists at \`glib >=0.20.0\`, but the supported
Tauri 2/GTK3 graph currently resolves affected \`glib 0.18.5\`.
The owner must select **one**:

- **time-limited exception** after proving all five accepted policy
  conditions (compatible-stack unavailability, reviewed no-known-reachable
  path, concrete mitigations, named owner/review date, honest public note);
- **documented Linux Stable-scope change** with updated user-facing claims
  and a reviewed adjustment of *mandatory* Linux acceptance — not a hidden
  waived \`linux-device\` gate;
- **NO-GO** while Linux Stable remains advertised and no supported
  remediation or accepted exception exists.

The alert must not be marked fixed or dismissed merely to pass CI.

**Owner result:** NO-GO pending authorized decision; \`security-review\`
and \`linux-device\` gates **PENDING**.

## 3. #390 — signed artifact, actual update + rollback evidence

**Existing source-level update tests and package CI are reusable**; they do
not certify the actual distribution assets or real-device rollback. The
required actions are candidate-scoped and non-destructive to real manuscripts.

### Freeze/build/verify candidate (no publication)

1. After #765 and #271 decisions, record the **exact 40-digit main SHA**
   and ensure no unexpected changes are merged. Decide Stable/Preview/
   Experimental advertised platforms, browser/format targets, and owners.
2. GitHub Actions → **Tauri Builds and Releases** → **Run workflow**
   on **main** with \`candidate_only=true\`, and **without** \`release_tag\`
   or \`release_approval\`. Record the successful **run ID** for the exact
   candidate. Ordinary push builds cannot replace the documented
   candidate-only selection.
3. Run/dispatch the same-SHA CI/CD, CodeQL, SPEC-320, 1.0 Readiness and
   PKP integration workflow for OJS **3.5.0-4 and 3.5.0-5**; collect pinned
   plugin commits and the OMP Preview evidence. Run the **E02 exact-commit
   evidence workflow**. Missing/queued/skipped/mismatched workflow or archive
   is **NOT PASS**.
4. Check independently **every generated release file** against a SHA-256
   manifest, immutable build run, source SHA and correct version/package
   identity. Verify desktop updater's trusted public-key signatures and
   approved release metadata; verify Android APK signing certificate or
   Google Play lineage, versionCode and channel. Linux \`.deb\` being present
   or hash-matched does **not alone** mean it has a signed updater. Record
   explicitly which release/install channels are signed and which are not.

### Bounded device and rollback exercises (synthetic data only)

| Stable target | Minimum actual acceptance | Required failure-safe rollback proof |
| --- | --- | --- |
| Windows 11 x86-64 | Candidate MSI/NSIS signatures/identity; install, launch, upgrade via supported signed path; preserve a synthetic OMI document | On a **test machine or VM**, return to an approved known-good build/restore point; reopen document and check revision/notes; do not overwrite personal profile or assume binary downgrade automatically reverses schema migrations |
| Android 10+ / Play | Candidate versionCode, Play signing and channel verified; upgrade on recorded physical reference phone; launch, reopen synthetic content | Use approved Play/backup recovery procedures on disposable test data. **Android generally rejects normal in-place downgrade**; reinstall/restore is a different procedure and may erase local data, so verify backup/recovery and record that limitation |
| Ubuntu 22.04/24.04 x86-64 | Candidate DEB/AppImage content hashes, origin, native launch, edit/save, upgrade on disposable Linux instance | Restore prior signed/trusted package *and* compatible app-state backup / VM snapshot. Do not test by downgrading the production machine or by assuming \`dpkg\` restores user data |
| Web/API container | \`sha-<commit>\` build tied to API/web image **digests**, health and real document semantic round trip; no release mutable-tag assumption | In a distinct staging deployment prove rollback to previous digest and **DB/storage** snapshot compatibility. Never experiment with the live Plesk/PHP environment or treat image revert as database rollback |
| OJS 3.5.0-4/5 | Signed/authorized connector version + exact plugin SHA; export/import + permission/anonymity/provenance on **both** versions | Restoring plugin/configuration and article/review state in isolated OJS testing; OMP stays Preview |

For signed update/rollback, keep these fields privately for each **actual**
platform run: candidate source SHA, build run ID, file SHA-256,
signature verification tool/result, installer/update channel and version,
before/after version + document-state comparison (counts/digests only),
restore path, user/UTC observation, and an HTTPS redacted evidence reference.
A generic claim that "rollback is possible" is **not** an observed rollback.

### 13-key owner receipt (use *only* existing v1 contract)

Do **not** create a different approval schema. The mandatory IDs in
\`scripts/rc-evidence.mjs\` are:

1. \`host-egress\`
2. \`host-pdf-sandbox\`
3. \`private-manuscript-preservation\`
4. \`windows-device\`
5. \`linux-device\`
6. \`android-device\`
7. \`ojs-3.5.0-4\`
8. \`ojs-3.5.0-5\`
9. \`security-review\`
10. \`accessibility\`
11. \`performance\`
12. \`recovery\`
13. \`owner-go-no-go\`

Each \`pass\` requires the **same reviewed candidate sourceSha**, an
actually observed UTC timestamp and a suitable HTTPS evidence reference.
The #774 staging worker receipt is a **reusable linked observation** for
\`host-pdf-sandbox\`, not automatic signing of that gate. Preserve redacted
evidence only; keep real manuscript titles, text, authors, metadata, server
IPs, tokens and local filesystem paths out of public logs.

### Strict gate and release

- Resolve the #390 \`rc-required\` **pre-/post-release task circularity**
  explicitly with the owner (separate pre-RC authorization from the
  planned 2–4-week monitoring). Do not relabel it silently.
- Run the actual **strict** release readiness/E02 and candidate-only
  publication guard with all evidence on one immutable main SHA. General
  green Readiness or a closed issue cannot substitute.
- **Only if every required check truly PASS, all blockers are resolved and
  owner has documented GO**: dispatch the published release workflow with
  \`APPROVE_1_0_RELEASE\`, \`release_tag=v1.0.0-rc.1\`,
  \`release_reviewed_sha\`, exact prior \`release_build_run_id\` and
  validated \`release_evidence_json\`. Never provide this phrase as a
  speculative or preapproved placeholder.
- No tag, release or public Stable claim until the gate succeeds.
  RC1's planned 2–4-week observation is **after** the RC publication,
  not proof of a completed trial today. GA \`v1.0.0\` remains a separate
  later decision.

## 4. Owner execution table (all deliberately unapproved)

| Release requirement | State | Next evidence |
| --- | --- | --- |
| #765 live API host egress | **BLOCKED** | Exact candidate+host positive and negative acceptance worksheet |
| #774 host worker sandbox | **PENDING sign-off** | Link existing successful host/stage results to exact candidate |
| #271 Linux advisories | **NO-GO decision pending** | All-five-criteria exception or approved Stable-scope change |
| Exact candidate E02 / strict release | **NOT RUN** | Candidate-specific dispatch, all required results and matching IDs |
| Actual native file checksums/signatures | **NOT ACCEPTED** | Hash manifest, signing authority, platform build run ID |
| Signed update and rollback | **NOT ACCEPTED** | Disposable device/VM outcomes + preservation/restore receipts |
| OJS and supported client owner acceptance | **PENDING** | Missing candidate-specific delta only |
| #390 label/governance and owner final GO | **PENDING** | Pre-RC task split and authorized timestamped decision |
| **RC1 publication** | **NO-GO** | All gates PASS; only then authorized manual release |

**Important:** merging this *documentation* does not change the application's
runtime security, code-signing configuration, stored documents, GitHub
branch protection, workflow run status or owner authorization. It creates
no release tag, build, deployment or external credentials.
