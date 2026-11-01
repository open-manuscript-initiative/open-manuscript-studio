# Exact-candidate RC evidence

The 1.0 publish guard supplements the existing strict issue/local gate. A green beta workflow or closed issue does not approve RC. No current candidate is approved by this document.

1. Build the exact proposed main SHA with `Tauri Builds and Releases`. Its 1.0 publish step may fail for absent approval while the build jobs succeed. Keep the immutable build run/artifacts.
2. Run Studio CI, CodeQL, PKP integration and 1.0 Readiness for that exact main SHA; dispatch the path-filtered workflows explicitly when necessary. Finish all actual device, host, privacy, accessibility, recovery and performance acceptance on those artifacts. Record only redacted pass/fail references.
3. Prepare the `omi-studio-rc-evidence` JSON below. `artifacts` must name and hash **every file** produced by the publish job's stable-name preparation, excluding `SHA256SUMS.txt`. Download/relabel the candidate artifacts using the same names before reviewing. Do not include private manuscript data. This is an explicit owner attestation, not an independent signature or automatic test of physical devices.
4. Dispatch the same exact main SHA with `release_tag`, `release_reviewed_sha`, approval phrase `APPROVE_1_0_RELEASE`, `release_build_run_id` and `release_evidence_json`. The job validates the prior build's source/repository/path/jobs and downloads those exact artifacts. It checks receipt hashes against actual bytes and verifies all workflow run subjects/results through GitHub before the strict issue gate and tag creation.
5. Missing, skipped mandatory, unavailable or mismatched evidence fails closed. Failed deploy jobs alone may be skipped in the CI evidence; other skipped jobs are incomplete evidence. No automated date/score override exists. Keep the receipt with owner-controlled release records and the Actions run; final release SHA256/SBOM/signature rules still apply.

Receipt shape (`buildRunId`, `sourceSha`, hashes, dates and references below are placeholders; never paste them as real evidence):

```json
{
  "format": "omi-studio-rc-evidence", "version": "1",
  "sourceSha": "<exact 40-character main SHA>", "buildRunId": 123,
  "owner": "<reviewing owner>", "reviewedAt": "<ISO UTC timestamp>",
  "artifacts": { "<every prepared release filename>": "<SHA-256>" },
  "workflows": [
    { "path": ".github/workflows/ci.yml", "runId": 124 },
    { "path": ".github/workflows/codeql.yml", "runId": 125 },
    { "path": ".github/workflows/pkp-integration-environment.yml", "runId": 126 },
    { "path": ".github/workflows/1.0-readiness.yml", "runId": 127 }
  ],
  "gates": [
    { "id": "host-egress", "status": "pass", "sourceSha": "<same SHA>",
      "observedAt": "<ISO UTC timestamp>", "evidenceRef": "https://<redacted acceptance record>" }
  ]
}
```

Supply every gate in `RC_MANUAL_GATES` from `scripts/rc-evidence.mjs`: host-egress, host-pdf-sandbox, private-manuscript-preservation, windows-device, linux-device, android-device, both supported OJS versions, security-review, accessibility, performance, recovery and owner-go-no-go. The prior build must include successful Windows/Linux/macOS/Android build jobs; this does not promote macOS from Preview. OMP and iOS maturity are unchanged. No assertion can waive an open release blocker; independently assessed conformance remains a separate governance decision.
