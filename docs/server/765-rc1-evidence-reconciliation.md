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

## 2026-11-03 late-evening actual-deploy and positive-flow delta

Reviewed deployed source: `a0d0ca1ea9bd299361e74dd660e1685d0253d450`. The
operator's **22:31 CET** read-only process inspection confirmed
`SOURCE_MATCH=true`, `RUNTIME_CWD_MATCH=true`, and
`RUNTIME_ENTRYPOINT_MATCH=true` with the matching successful GitHub
production deploy. A shell typo originally invalidated the modification-time
check; the **22:34 CET** corrected command then reported
`DIST_CHANGED_AFTER_START=false` and
`RUNTIME TIMESTAMP CHECK: PASS`. This establishes a credible checkout /
on-disk compiled JS / current process path correlation, **not** a verified
in-memory module attestation or a signed RC artifact digest.
[Owner evidence and correction](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6616010235).

The operator then explicitly reported **3/3 success** for the targeted
positive integration smoke on the current deployed application:

| Changed integration path | Observed result | Remaining identification limit |
| --- | --- | --- |
| OJS connection and safe test-manuscript import | **PASS, operator** | Exact OJS 3.5.0-4 versus 3.5.0-5 instance not reported; one result does not approve both |
| Connected cloud storage open → save → reopen | **PASS, operator** | The individual provider was not specified; no claim that Drive, OneDrive and Dropbox all passed |
| ORCID/OIDC sign-in → return to Studio | **PASS, operator** | Specific identity provider and separate callback variants not enumerated |

[Operator positive smoke report](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6616203667).
These results **close the three-request functional delta smoke**, without
substituting for negative security verification, separate OJS version coverage
or exact RC manual `pass` receipts.

### Source-based outbound transport inventory (review, not an exploit test)

At the reviewed source SHA, user-configurable OJS/OMP integration transports,
WebDAV and OIDC/JWKS flows use connection-pinned HTTP/DNS validation;
the `#765` mock-DNS regression suite exercised this transport logic.
Several separately scoped provider integrations (including OAuth cloud
provider calls, cloud OAuth token exchange, reference managers and DeepL)
also contain direct `fetch` operations. These often use known provider
domains, but they **must not** be silently included in the connection-pinned
coverage claim. Verify for each actually enabled transport whether request
destinations and provider redirects can reach unexpected networks through
proxies, DNS changes or browser-controlled input. This is a coverage gap
to review, **not** a finding of a demonstrated bypass or a reason to alter
working production connectors without evidence. See:
`server/src/cloud/providers/oauth/OAuthCloudProvider.ts`,
`server/src/cloud/oauth/cloudOAuth.ts`,
`server/src/integrations/referenceManagers/referenceManagerService.ts`,
`server/src/integrations/integrationExecution.ts`.

**No further general source, BPF or canary rerun is requested.** Remaining
tests must be precisely scoped, authorized and safe. Until then the actual
API-process negative destination behavior remains **NOT VERIFIED**.

## Still missing — do not silently approve

| Requirement | Required scope | Current state |
| --- | --- | --- |
| Matching candidate SHA to actual deployed API and build digest | Source/CWD/entrypoint/timestamps match current deploy; signed exact RC artifact digest remains outstanding | PARTIAL — signed RC receipt PENDING |
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
- Positive current-deploy OJS/one cloud/ORCID smoke: 3/3 PASS (operator); individual provider and both OJS Stable target versions: PENDING
- Live API end-to-end negative connection guard: NOT VERIFIED
- Proxies, DNS rebinding, boot persistence and rollback: PENDING
- Operator/security reviewer, UTC date and evidence URL: PENDING
- RC manual gate host-egress: **NOT APPROVED**
- #765 issue: **OPEN release-blocker**; RC1: **NO-GO**

Related:
[production acceptance template](../../deployment/egress/acceptance-TEMPLATE.md),
[final RC owner tasks](../release/2026-11-03-rc1-final-operator-actions.md),
[RC evidence schema](../release/rc-evidence.md).
