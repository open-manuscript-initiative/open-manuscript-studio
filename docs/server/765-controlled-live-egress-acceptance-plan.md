# #765 — controlled API egress negative-path acceptance plan (RC1)

**Status: PREPARED / NOT EXECUTED / NOT APPROVED.** This plan complements `deployment/egress/acceptance-TEMPLATE.md` and the existing #765 evidence. It does not create a `host-egress` PASS, approve an exception, or authorize RC tagging.

## Already accepted as supporting evidence (do not repeat without reason)

- Read-only actual API unit/cgroup and attached BPF verification: 7/7 booleans true (2026-11-03).
- Separate transient policy-cloned IPv4/IPv6 baseline and filtered kernel socket canaries: PASS; **not** direct live API process denial.
- Source-level pinned-connection DNS/SSRF regressions: 8/8 PASS.
- Operator-reported current-deploy OJS, one cloud provider and ORCID/OIDC positive smoke: 3/3 PASS, with documented version/provider limits.
- PDF worker evidence belongs to #774 and is not a substitute for API network acceptance.

See [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765) and [#390](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/390).

## Pre-execution authorization (required)

1. Security owner and host operator approve **in writing** the exact test scope, synthetic inputs, test window, permitted destination categories, rollback and abort criteria.
2. Freeze candidate source SHA and actual running API build identity; record artifact digest, unit/cgroup boundary, and test harness commit/digest. A source checkout SHA alone does not prove loaded runtime identity.
3. Prefer a **separate, isolated staging deployment of the exact candidate** with the same effective systemd network policy, application transport code and proxy configuration. Mark staging observations as staging; they do **not** automatically prove production enforcement.
4. A direct production API-path test is permitted only after independent review establishes that it cannot reach real internal services or metadata endpoints, change data, disrupt clients or leak credentials. Otherwise leave production acceptance NOT VERIFIED and use the formal release-scope/risk decision process.
5. Shared Plesk UID: **never** install UID-wide nftables, alter Plesk/PHP-FPM policies, change permanent firewall rules, restart the live API/worker, or inject a root-run arbitrary network probe into its cgroup.

## Controlled negative-path matrix

Use a reviewed synthetic URL-consuming application route and **non-sensitive test-owned endpoint fixtures**, not arbitrary remote targets. The harness must refuse unapproved destinations and have a bounded timeout and an explicit no-side-effects mode. For each case record expected deny and observed deny/allow, without raw IP, hostname, credentials or request bodies in public logs.

| Case | Required observation |
| --- | --- |
| IPv4 private/reserved, link-local and loopback | Denied at the correct connection/path boundary unless explicitly authorized loopback service |
| IPv6 ULA/link-local/loopback and IPv4-mapped forms | Denied or explicitly justified within the same policy |
| Cloud metadata address categories | Denied without contacting real metadata services |
| DNS public-to-private rebinding | Connection-time validation denies changed/private answer |
| Public-to-private HTTP redirect | Redirect policy refuses destination before connection |
| HTTP(S) proxy and alternate fetch helpers | No bypass of address/redirect policy |
| Worker/container/helper delegation | No unreviewed route around API cgroup or application transport controls |

**Do not use actual internal targets as test endpoints.** When a case cannot be safely simulated and attributed to the running API connection path, mark it NOT VERIFIED instead of claiming PASS.

## Positive-path and recovery checks

- Reuse same-deployment authorized OJS, one configured cloud provider and ORCID/OIDC evidence where SHA, provider and timestamp are attributable; test only remaining enabled integrations (including WebDAV, Office, mail and DB/proxy health as applicable).
- Verify legitimate allowed loopback PostgreSQL/proxy/collaboration behavior, with no production data writes beyond dedicated test-owned resources.
- Verify read-only service health before/after; abort on any unexpected allow, customer-facing error, timeout, service restart, changed cgroup/BPF policy or unauthorized outbound attempt.
- Record boot persistence and rollback readiness through reviewed configuration/snapshot evidence; do not reboot or apply rollback solely for this acceptance exercise.

## Redacted operator receipt (fill only after observation)

| Field | Result |
| --- | --- |
| UTC timestamp, named security/operations owner | PENDING |
| Candidate source SHA and actual running build digest | PENDING |
| Approved test plan/harness revision and scope | PENDING |
| Actual production API-path negative result (or STAGING ONLY) | NOT VERIFIED |
| IPv4/IPv6, metadata, DNS, redirects and proxy/helper coverage | NOT VERIFIED |
| Positive authorized integration continuity | PARTIAL — historic 3/3; exact candidate pending |
| Recovery, boot persistence and rollback evidence | NOT VERIFIED |
| Residual risks, evidence URL, operator signature/approval | NOT APPROVED |
| `host-egress` strict RC gate receipt | NOT APPROVED |

**Exit criterion:** only the security owner can accept a complete, exact-candidate, redacted evidence package with explicitly scoped exceptions. Keep #765's release-blocker disposition under review and #390 RC1 **NO-GO** until the required strict gate and all other mandatory release conditions pass. No private manuscript, paths, endpoints, tokens or raw logs in public evidence.
