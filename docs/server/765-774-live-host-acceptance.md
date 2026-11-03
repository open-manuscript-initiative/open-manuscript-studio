# #765/#774 live-host acceptance — safe first step

**Review-only; no production policy or PDF-worker change is made by this PR.**
Use the current states of [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765) and [#774](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774), not the historic closure noted in 2026-11-02 ADR-031.

## Existing evidence to reuse

#774 already has dated operator observations of a dedicated non-root worker, group-restricted Unix socket, network namespace without IPv4/IPv6 routes, external HTTPS denied, protected filesystem, no credential-like environment variable *names*, successful render/import, two simultaneous distinct-owner jobs, same-owner rejection, malformed-input rejection, and normal post-job cleanup. The merged #819 has synthetic POSIX process-group timeout/descendant tests. These observations **do not** demonstrate a forced-timeout followed by recovery on the deployed binary.

#765 has a working pinned-connection HTTPS transport in application code; however the **shared Plesk UID** also belongs to PHP-FPM sites. Never apply the UID-based nftables generator to this production host. The staged alternative is the API-unit-only systemd cgroup drop-in in `deployment/systemd/omi-studio-api-egress-shared-uid.conf`, described in `docs/server/api-egress-shared-uid-rollout.md`. Its partial private-range denials are insufficient against loopback SSRF, so user-controlled URL paths must retain public-address pinning at connection time.

## 1. Non-disruptive inspection (root terminal on the production VPS)

From the actual reviewed and deployed checkout:

```bash
cd /var/www/vhosts/openmanuscript.org/studio/repository
/opt/plesk/node/24/bin/node scripts/acceptance/host-security-preflight.mjs
```

This reads bounded `systemctl show` properties, `/proc/<pid>/cgroup` membership and the PDF Unix socket inode and expected ownership. It performs **no HTTP/DNS probes**, firewall changes, restarts, .env reads, uploads or writes. Output contains only constant-label booleans; no usernames, PIDs, host IPs, secret values or manuscript data. Inactive services yield exit code 2. Even an all-true configuration summary intentionally leaves `OPERATOR_ACCEPTANCE_REQUIRED` because the host's effective cgroup eBPF denials, negative tests and candidate provenance are **not** thereby verified.

## 2. #765 remaining release gate (operator-approved staging and maintenance)

1. Record the exact deployed API SHA and live systemd service identity privately. Inventory local PostgreSQL, proxy, collaboration, DNS, mail and authorized OJS/OMP/OIDC/WebDAV/cloud endpoints **without sharing credentials**.
2. If the API-only unit filter is not active, test the existing reviewed systemd drop-in on a separate staging unit and rehearse a tested IONOS snapshot + second SSH session rollback. Only then may the operator authorize the production API restart; do not change any Plesk UID or apply global host/nftables rules.
3. Independently verify effective IPv4/IPv6 kernel denial **within the actual API service cgroup** (not just `runuser` or `nsenter`), using only authorized canaries. Verify both public-to-private DNS rebinding rejection in the actual HTTP socket transport and preserved legitimate loopback DB/proxy operations. Treat localhost and public egress as residual risks of the unit filter.
4. Confirm real authorized WebDAV, PKP, OIDC, cloud storage, EuroOffice, mail and collaboration flows, and review any independent proxies/connectors and container namespace bypasses.
5. Record rollback, persistence and a content-neutral signed-off host receipt; keep #765 open until accepted. Do not probe arbitrary production journals or internet targets.

## 3. #774 remaining release gate (controlled staging; no live forced hang)

1. Reuse existing issue-linked positive/negative host evidence. Verify the deployed worker modules in `/opt/omi-pdf-worker` really include the merged `security/pdfSubprocess.js` process-tree cleanup from #819 and are built from the exact reviewed SHA.
2. On an **isolated staging worker**, run `npm --prefix server run test:isolated-pdf-worker` plus a bounded synthetic parent/grandchild forced-timeout scenario. Verify the timeout terminates the process group, leaves no descendant, and the next PDF render succeeds. Do **not** intentionally hang production or weaken resource limits.
3. Verify fail-closed API behavior when the worker socket is unavailable (only on staging), plus the live socket, cgroup, group owner, network/mount/resource properties and actual PDF success. Note the limitations of POSIX process groups against descendants that create new sessions, Windows fallback and multi-host quotas.
4. Record exact SHA, observed environment/time, output hashes, results and private evidence reference. Keep #774 open until the operator signs the host receipt.

## 4. RC boundary

Use the existing `RC_MANUAL_GATES` model in `scripts/rc-evidence.mjs`: **separate** `host-egress` and `host-pdf-sandbox` accepted records, bound to the same reviewed release candidate SHA/build hashes. Never mark either gate passed from code/CI/issue state alone. After both are accepted, rerun the strict RC gate; no tag or release is created by this PR.

Related: `docs/server/security-acceptance-reconciliation.md`, ADR-031, and `docs/release/rc-evidence.md`.
