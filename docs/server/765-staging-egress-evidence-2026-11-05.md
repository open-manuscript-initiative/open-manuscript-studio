# #765 staging outbound-egress operator evidence — 2026-11-05

Status: **STAGING PARTIAL PASS / RC1 NO-GO**. This is an operator-observed record from Plesk root-terminal screenshots, not an independently collected, signed host receipt. No production change or production acceptance is claimed.

## Isolation and service

- Test unit: `omi-staging-api.service`; test app: `/var/lib/omi-staging-api/app/server`.
- Separate from production `omi-studio-api.service` (production service was not intentionally restarted or modified during these checks).
- Staging bound to `127.0.0.1:3301`, with collaboration WebSocket port `3302` to avoid collision with production.
- `systemctl is-active omi-staging-api.service` returned `active`; `curl --noproxy '*' http://127.0.0.1:3301/api/health` returned HTTP 200, including after a staging restart.
- Staging systemd policy: `IPAddressDeny=0.0.0.0/0 ::/0`; `IPAddressAllow=127.0.0.0/8 ::1/128`.
- Root `bpftool cgroup show /sys/fs/cgroup/system.slice/omi-staging-api.service` displayed `sd_fw_ingress` and `sd_fw_egress` attached, including after staging restart.
- `/sys/fs/cgroup/system.slice/omi-staging-api.service/cgroup.procs` listed the staging main PID, demonstrating process membership at inspection time.

## Negative connectivity observations

Using a short-lived Python child moved into the **staging service cgroup** by writing its PID to `cgroup.procs`, with 3-second socket timeouts:

| Target | Outside staging cgroup (control) | Inside staging cgroup | Interpretation |
|---|---|---|---|
| IPv4 `1.1.1.1:443` | CONNECTED | `TimeoutError` | Consistent with outbound deny |
| IPv6 `2606:4700:4700::1111:443` | CONNECTED | `TimeoutError` | Consistent with outbound deny |
| Loopback `127.0.0.1:3301` | N/A | CONNECTED | Allowed loopback connectivity |

The tests were conducted sequentially using the same destination addresses; they are not packet-level proof of why the connection timed out. Together with attached systemd eBPF programs and explicit `IPAddressDeny` policy, they provide **strong staging-level evidence**, not an unconditional production PASS. A previous `systemd-run --scope` probe produced loopback `ConnectionRefusedError` and external `TimeoutError`; this is supporting evidence only, not proof that the scope inherited the exact service policy.

## Security regression tests

- Staging Node.js: Plesk Node 24.22.2.
- `node --import tsx --test src/integrations/security/oidcMetadataHttp.test.ts` executed in staging server app: **4 passed, 0 failed**.
- An earlier invocation via `npm run test:oidc-ssrf` failed with `ReferenceError: crypto is not defined` inside `jose`; direct `node --import tsx --test` subsequently passed. Do **not** silently mark the npm-script execution as passing. The runtime/test harness discrepancy remains to be diagnosed.
- The four passing checks cover remote URL rejection, Microsoft issuer binding, JSON byte limits, and pinned OIDC discovery/UserInfo/JWKS redirects.

## Remaining acceptance gates

1. Verify the exact staging candidate runtime/build digest against the intended RC release.
2. Validate legitimate OJS, ORCID/OIDC, and each enabled cloud-provider workflow under the intended **approved** egress policy. The current deny-all-except-loopback policy is intentionally unsuitable for direct external integrations without a separately approved egress mechanism.
3. Exercise redirect, proxy and DNS-rebinding paths against the running staging API, with safe test fixtures and no real credentials.
4. Record boot persistence, controlled rollback, and post-rollback health/eBPF checks.
5. Capture a dated, authorized operator/owner receipt, including commands, policy, test outputs, environment identity and review sign-off. Do not treat a screenshot or an offline receipt-validator PASS as production approval.
6. Complete the corresponding **production** acceptance separately, under an approved change window, before clearing #765 / RC1 blockers.

**Do not** broaden Plesk host firewall rules, apply UID-wide network blocks, or modify/restart the production API as a side effect of these staging checks.
