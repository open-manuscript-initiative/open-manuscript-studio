# #765 — OMI Studio API egress with a shared Plesk UID (staged, not deployed)

**Decision (2026-11-01): retain the Plesk account used by the Studio family of
sites.** The UID-based nftables profile from PR #820 is **NOT SAFE to apply**
to the live host: the API UID is also used by PHP-FPM pools for Studio
subdomains. The approved approach is a **systemd service-cgroup filter**, not a
UID firewall. This folder contains a review-only drop-in; **nothing in this
repository automatically installs or enables it**.

## Verified facts, not assumptions

- `omi-studio-api.service` runs with a Plesk non-root user, currently UID
  10018. PHP-FPM pools share this UID; keep their identities unchanged.
- The API uses `/opt/plesk/node/24/bin/node`, serves the local proxy on
  `127.0.0.1:3001`, and collaborates on `127.0.0.1:3022`.
- PostgreSQL 16 listens at `127.0.0.1:5432` and `[::1]:5432`; the API's
  actual DSN must still be confirmed without exposing credentials.
- The separate PDF worker is in its own network namespace, listens through
  `/run/omi-pdf-worker.sock` with mode 0660 and group `omi-pdf-clients`.
- A live PDF export/download has succeeded. **None** of these facts proves
  that API outbound egress policy has been applied, or that SSRF is eliminated.

## Why a per-service drop-in is preferable

`IPAddressDeny=` and `IPAddressAllow=` attach systemd's cgroup-based socket
filter to the *unit's* processes. Other PHP-FPM pools with the same Unix UID
remain outside that unit's cgroup. They are not targeted by this drop-in.

`deployment/systemd/omi-studio-api-egress-shared-uid.conf` is an **optional,
partial** baseline: deny selected private/link-local/reserved IPv4 and IPv6
ranges while leaving loopback (required for PostgreSQL/proxy) and the public
Internet reachable. It is **not** an allowlist of external services, and it
does **not** block loopback SSRF or arbitrary public destinations.
`IPAddressAllow=localhost` overrides matching deny rules for loopback; it
also permits **all** localhost ports, not only PostgreSQL. Neither systemd
IP-list setting filters by TCP port. Be explicit about this residual risk.

`server/src/cloud/security/connectionPinnedHttp.ts` provides a separate
layer for direct user-configured WebDAV/Nextcloud: each request's *actual socket
DNS lookup* rejects any nonpublic address, keeps the HTTPS host for certificate
verification and never follows redirects. This protects that transport from
DNS validation/connect races. **Do not claim global API SSRF protection**:
OJS/OMP, public publishing and other user-controlled URLs need equivalent
connection-time policy/audit before #765 can be accepted.

## Review-only preflight (root, no changes)

```bash
systemctl show omi-studio-api.service -p User -p MainPID -p ControlGroup -p IPAddressAllow -p IPAddressDeny -p ActiveState
systemctl show omi-pdf-worker.service -p User -p PrivateNetwork -p IPAddressDeny -p IPAddressAllow
ss -lntp | grep -E ':(3001|3022|5432)\\b' || true
cat /etc/resolv.conf
systemd --version
systemctl status omi-studio-api.service --no-pager
```

Verify the actual DNS resolver: if external DNS relies on a *private* network
address, this drop-in can break it. Inventory all networked integrations:
PostgreSQL, identity/OIDC/ORCID, Google/Microsoft/Dropbox, authorized
OJS/OMP journals, WebDAV/Nextcloud, email, DeepL, Transkribus, archives,
research sources and collaboration. Confirm the PDF socket is still usable.
Test on a separate staging API/service first.

## Staged activation — separate maintenance approval required

Do not run this block merely because a PR has merged. Take a tested IONOS
snapshot and keep an independent root SSH session open for emergency rollback.
Review the exact file and ensure systemd's IP BPF filtering works on this host.

```bash
# MAINTENANCE ONLY: this changes service configuration; the real API stays
# running until a separate approved restart.
install -d -m 0755 /etc/systemd/system/omi-studio-api.service.d
install -m 0644 deployment/systemd/omi-studio-api-egress-shared-uid.conf \
  /etc/systemd/system/omi-studio-api.service.d/80-egress.conf
systemctl daemon-reload
systemctl show omi-studio-api.service -p IPAddressDeny -p IPAddressAllow
# Stop here for human review; do not restart automatically.
```

Activation must explicitly restart only the API in a controlled window.
A drop-in sitting on disk with the old PID does **not** prove enforcement.
Confirm active cgroup/BPF support in the system journal and service properties
after restart, and perform positive/negative network tests *inside that unit's
cgroup*. Merely running `runuser -u <same Plesk user> curl ...` does NOT
enter the unit cgroup and does not test the filter. Similarly, an arbitrary
`nsenter` shell is not evidence for this cgroup policy.

**Rollback, if separately activated:**

```bash
rm -f /etc/systemd/system/omi-studio-api.service.d/80-egress.conf
systemctl daemon-reload
systemctl restart omi-studio-api.service
curl -fsS --max-time 10 http://127.0.0.1:3001/api/health >/dev/null
curl -fsS --max-time 10 https://studio.openmanuscript.org/api/health >/dev/null
```

Remove only this specific file if it is the drop-in installed by this plan.
Never flush Plesk nftables, change unrelated UID/group memberships, change PHP
pools, move PostgreSQL, remove PDF-worker sandboxing, or mass-chmod the vhost.

## Acceptance checklist — NOT VERIFIED on the live VPS

1. The same UID belongs to other PHP-FPM pools, but only the API service
   cgroup is filtered; verify unchanged PHP-FPM connectivity independently.
2. A controlled canary inside the API cgroup is denied by the kernel for IPv4
   RFC1918, link-local and metadata, IPv6 ULA and link-local; prove which
   IPv6 transition/mapped cases are covered rather than assuming.
3. Loopback PostgreSQL, nginx/API, collaboration and PDF-worker remain healthy
   after API restart. No plaintext credentials in logs.
4. Real authenticated WebDAV/Nextcloud requests work, reject A/AAAA rebinding
   to `127.0.0.1`, `169.254.169.254`, `::1` and `fd00::1` during connection,
   and never follow redirects.
5. OJS/OMP, OAuth/OIDC, mail, external publishing and other dynamic provider
   endpoints remain operational, with their *own* SSRF risks reviewed.
6. Docker/containers, other processes with the same UID and paths outside the
   service cgroup are assessed separately. Check that any HTTP proxy or
   external helper does not bypass policy.
7. Audit permitted loopback destinations: the WebDAV guard protects its own
   transport, but another URL-based connector could still reach an allowed
   local service. Resolve by connection-time pinning across connectors or a
   dedicated outbound broker; do not mark #765 PASS yet.
8. Test rollback and boot persistence safely; capture redacted host evidence.

**Status:** code review and CI unit tests are useful, but no production network
policy is installed by this PR and no full host acceptance is claimed. Keep
#765 as an unresolved security release gate until every required scenario has
actual-host evidence. The old UID-based nft generator and checker remain for
dedicated-UID deployments only: see
`docs/server/api-egress-policy-rollout.md`.
