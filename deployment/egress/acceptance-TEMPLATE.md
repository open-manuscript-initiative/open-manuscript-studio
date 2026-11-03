# #765 — production Studio API egress operator acceptance (shared Plesk UID)

**Status: UNAPPROVED / NOT VERIFIED.** Do not mistake a template, green CI,
working WebDAV or a separately filtered canary for actual live API-cgroup
acceptance. This is a *content-neutral* operator worksheet. Do **not** paste
credentials, server IPs, DNS answers, vhost names, PIDs, document filenames,
manuscript contents or full raw systemd/firewall logs into public issues.

## Deployment identity and protection boundary

The production Plesk account is **shared with PHP-FPM sites**. **Do not run the
dedicated-UID nftables install/generator from older plans on this host.** The
reviewed control is the systemd eBPF IP filter scoped to
\`omi-studio-api.service\` (not its Unix UID, nginx, Plesk, PHP-FPM or
\`system.slice\`). The verified API cgroup, egress and ingress BPF attachment
and policy-cloned isolated private-network canary are recorded at
[#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765).
They are useful evidence, but copied rules on another cgroup are **not** a
direct negative test of the live API cgroup.

Loopback access required for local PostgreSQL, nginx and collaboration remains
allowed; the systemd IP filter is **not port-specific** and public Internet
access is not restricted to an external allowlist. The actual connection-time
public A/AAAA pinning and per-integration redirect policy remain essential.
Audit all URL-consuming helper paths, proxies and container/cgroup escapes.

## Owner observation (do not pre-fill PASS)

| Required field | Observation / reviewed evidence |
| --- | --- |
| Review timestamp (UTC) and owner | PENDING |
| Exact release candidate \`sourceSha\` (40 hex) | PENDING |
| Actually deployed API source/build digest and matching scope | PENDING |
| Running API PID/cgroup matched unit and BPF programs attached | PENDING — [earlier observation](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6607661842) can be linked with actual SHA |
| Baseline private-namespace v4/v6 socket reachability | PENDING — [previous PASS](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6611443455) in **separate** transient unit |
| API-policy-cloned cgroup v4 RFC1918/link-local + v6 ULA denials | PENDING — previous paired PASS in **separate** transient unit |
| Actual live API-cgroup negative connection-path acceptance | **NOT VERIFIED** — approved isolated/cgroup-consistent canaries only; do not inject arbitrary probes |
| Loopback DB, proxy and collaboration positive acceptance | PENDING |
| Authenticated OJS 3.5.0-4 and OJS 3.5.0-5 publishing/authorization | PENDING — versions must be checked independently |
| Enabled OMP, WebDAV, Drive, OneDrive, Dropbox, OIDC/ORCID and Office | PENDING — record only configured/enabled flows |
| Mail, external integrations and DNS resolver health | PENDING — don't expose private endpoint details |
| Controlled redirects, public-to-private DNS rebinding, IPv4-mapped, NAT64 and IPv6 local/transition paths | PENDING — clearly distinguish source regressions from real host tests |
| HTTP proxies, custom outbound fetchers, worker and containers assessed | PENDING |
| Shared-UID PHP-FPM isolation and unfiltered localhost/public egress residual risks | PENDING |
| IONOS snapshot, independent SSH recovery, rollback and reboot persistence | PENDING |
| Redacted HTTPS evidence location for the exact candidate | PENDING |
| Residual risks and operator/security reviewer decision | **NOT APPROVED** |

## Existing observations available without rerunning

- [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6608027104): 8/8 synthetic connection-pinned HTTP/DNS-rebinding regression tests.
- [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6607661842): API cgroup and attached systemd eBPF.
- [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6611443455): paired, positive + negative IPv4/IPv6 host-kernel socket probes in a **separate transient cgroup**, without stopping production.
- [Read-only preflight](../../docs/server/765-774-live-host-acceptance.md): inventory and evidence review; never install UID nftables or restart production as part of ordinary testing.

Use existing **actual production client flows** to attest legitimate providers,
where applicable. Do not substitute a random public HTTP 200 check for an
authenticated WebDAV upload or OJS editorial workflow. Obtain approval before
any live negative-cgroup injection; where safe verification is not possible,
leave the row **NOT VERIFIED** and #765 open or explicitly defer the affected
Stable scope through the documented release policy.

## Receipt relationship

The \`host-egress\` entry in \`scripts/rc-evidence.mjs\` must reference one
reviewed evidence document (HTTPS, access-controlled if needed), including its
actual \`observedAt\`, exact RC \`sourceSha\`, deployment scope, owner and
accepted limitations. This worksheet **does not** create that receipt and
**must not** cause the \`release-blocker\` label to be removed automatically.

Do not update permanent networking, enable a firewall, run privileged test
commands inside the service cgroup or restart the API from this worksheet.
