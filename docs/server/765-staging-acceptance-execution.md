# #765 staging acceptance — execution worksheet

**No test has been executed on the VPS by this change.** The validator is
offline and cannot certify network enforcement. It requires an operator-created,
privately stored JSON observation file and refuses to claim production acceptance.

## Execution order

1. Obtain written operator/security approval for a dedicated, non-production
   instance of the **exact** candidate build, network policy, test fixtures and
   rollback plan. Keep the production Plesk shared UID, API, firewall and
   application data untouched. Do not copy secrets or private manuscripts.
2. Independently provision the isolated instance and test-owned DNS/HTTP
   fixtures; review that all negative tests are simulated and cannot contact
   real RFC1918 services or cloud metadata endpoints. No live probe commands
   are supplied by this repository.
3. Record the exact source SHA, **actual** built artifact SHA-256 and harness
   SHA. Perform the matrix from
   [the accepted plan](765-controlled-live-egress-acceptance-plan.md).
   Distinguish application-level refusal from systemd cgroup kernel denial.
4. Record each observed result in a private JSON file matching the example
   below. `NOT_APPLICABLE` needs a separate reviewed justification; the
   validator does **not** turn it into proof.
5. Run `node --test tests/765-staging-receipt.test.mjs` then
   `node scripts/acceptance/765-staging-receipt.mjs /private/path/receipt.json`.
   Only redacted status labels are printed; keep the input private.
6. Link a **redacted** review document from #765. Even an all-PASS staging
   matrix leaves actual production API-path acceptance `NOT_VERIFIED`,
   `host-egress` `NOT_APPROVED`, and #390 RC `NO_GO`.

Example schema (placeholder hashes, not real evidence):

```json
{
  "schemaVersion": 1,
  "scope": "isolated-staging",
  "sourceSha": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "buildDigest": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "harnessSha": "cccccccccccccccccccccccccccccccccccccccc",
  "observedAt": "2026-11-05T08:00:00Z",
  "approvedByOperator": false,
  "noProductionMutation": true,
  "cases": {
    "ipv4PrivateLinkLocal": "NOT_VERIFIED",
    "ipv6UlaLinkLocalMapped": "NOT_VERIFIED",
    "metadataSynthetic": "NOT_VERIFIED",
    "dnsRebinding": "NOT_VERIFIED",
    "httpRedirect": "NOT_VERIFIED",
    "proxyAndAlternateFetch": "NOT_VERIFIED",
    "workerContainerDelegation": "NOT_VERIFIED",
    "authorizedOjsWebdav": "NOT_VERIFIED",
    "enabledCloudAndOidc": "NOT_VERIFIED",
    "loopbackDbProxy": "NOT_VERIFIED",
    "postTestHealth": "NOT_VERIFIED"
  }
}
```

Never set `approvedByOperator` to true until actual approval is recorded.
A JSON status entry is an operator assertion, **not** cryptographic or
independent proof. No script in this PR changes production or approves RC.
