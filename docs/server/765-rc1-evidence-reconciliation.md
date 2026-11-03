# OMI Studio #765 — RC1 host-egress evidence reconciliation

**Date:** 2026-11-03 (Europe/Budapest). **Status: PARTIAL EVIDENCE / RC NO-GO.**

This record reuses verified operator observations. It is not a signed RC
receipt. No production services, firewalls, Plesk accounts or release tags
are modified.

## Evidence already observed — do not repeat without a relevant change

| Observation | Scope | Result |
| --- | --- | --- |
| API running within its exact systemd cgroup, 16:13 and 21:14 CET | Actual production API process | OBSERVED |
| Active systemd ingress/egress BPF attachments, 16:17 and 21:14 CET | Actual production API cgroup | OBSERVED; does not prove connection denial |
| Eight DNS-rebinding and connection-pinned transport regressions, 16:34 CET | Mocked DNS and URL client code | 8/8 PASS |
| Paired unfiltered BASELINE and cloned-policy FILTERED IPv4/IPv6 probes, 18:52 CET | **Separate** transient systemd cgroups | PASS; not the actual production API socket |
| Post-#846 main CodeQL, CI/CD, Readiness, Tauri, OMI-SPEC-320 and egress-policy checks | Main commit 5555f7309dab9a34bfdf1d9f544afe781c79e5ac | PASS; not manual release approval |

See existing #765 evidence:
[API cgroup and BPF](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6607661842),
[SSRF regression](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6608027104),
[paired kernel canary](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6611443455),
[repeated live cgroup+BPF attachment](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6614426390).

The Plesk API identity is shared with PHP-FPM accounts. **Do not apply the
legacy UID-wide nftables generator**. The current safe boundary is the
API-specific systemd cgroup and its BPF attachments, together with
connection-time public-address validation in adopted URL transports. It
still permits some localhost paths and arbitrary public egress; these
residual risks must be assessed explicitly.

## New read-only evidence collector

The new file
[scripts/acceptance/host-egress-evidence.mjs](../../scripts/acceptance/host-egress-evidence.mjs)
is intended only for host inspection **after PR merge and exact SHA review**.
It reads the fixed production API unit's basic systemd properties,
the process cgroup, its BPF attachment names, and makes one GET
to the fixed loopback-only http://127.0.0.1:3001/api/health endpoint.

Output is JSON with UTC observation time and *only* fixed boolean fields;
no raw PID, user, group, IP address, credential, systemd command line,
request body or manuscript information is exposed. Missing BPF access
is NOT a PASS. Even when all checks are true the result is
OPERATOR_ACCEPTANCE_REQUIRED, not approved release evidence.

Run it from a **SHA-verified, root-owned temporary copy of the merged
script**, not from an unverified writable checkout. Use the exact reviewed
Git blob SHA and avoid executing a new source file as root merely because
it appeared in the branch. The read-only host report does not exercise
private IPs or any actual production API negative outbound request.

## Still missing — do not silently approve

| Requirement | Required scope | Current state |
| --- | --- | --- |
| Matching candidate SHA to actual deployed API and build digest | Not merely the checkout Git HEAD | PENDING |
| Actual API-cgroup negative IPv4/IPv6 connection and metadata/redirect/rebinding guard | Controlled, authorized live API behavior, not separate canary | NOT VERIFIED |
| Positive allowed integration workflows | Local DB/proxy/collaboration, OJS 3.5.0-4 and 3.5.0-5, enabled OMP/OIDC/ORCID/WebDAV/Google Drive/OneDrive/Dropbox/EuroOffice/mail only where enabled | PENDING candidate binding |
| Connection-time helpers, HTTP proxies, containers, localhost and residual public egress | Threat review and no alternate outbound bypass | PENDING |
| Shared Plesk UID isolation, reboot persistence and safe rollback | Operator observation without destructive changes | PENDING |
| Authorized host-egress owner receipt | Same approved RC SHA, UTC observation, HTTPS redacted evidence reference, risks and signature | NOT APPROVED |

**Do not inject arbitrary traffic into the live service cgroup**, probe
unapproved cloud metadata endpoints, run the dedicated-UID firewall
installer, restart services or upload private logs/manuscripts. If an exact
live negative test cannot yet be performed safely, leave it NOT VERIFIED;
the existing copied-policy PASS must not be represented as direct live
proof.

## Owner receipt (unfilled)

- Actual RC source SHA and deployed API artifact digest: PENDING
- Positive enabled-provider/DB workflow observations and dates: PENDING
- Live API end-to-end negative connection guard: NOT VERIFIED
- Proxies, DNS rebinding, boot persistence and rollback: PENDING
- Operator/security reviewer, UTC date and evidence URL: PENDING
- RC manual gate host-egress: **NOT APPROVED**
- #765 issue: **OPEN release-blocker**; RC1: **NO-GO**

Related:
[production acceptance template](../../deployment/egress/acceptance-TEMPLATE.md),
[final RC owner tasks](../release/2026-11-03-rc1-final-operator-actions.md),
[RC evidence schema](../release/rc-evidence.md).
