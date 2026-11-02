# ADR-031 — Outbound security contracts and acceptance evidence

Date: 2026-11-02. Status: proposed reconciliation of merged implementation at `7c4b2826e7b6a2d718f45fced917e9cfab4d42a9`; merge/CI of this documentation is separate from host and RC acceptance. Refines OMI architecture ADR-012/014/016/017/019.

## Question

How do the shared Plesk API identity, service-scoped egress, connection-pinned HTTP and separate PDF worker compose, and what does closing #765/#774 prove?

## Decision and ownership

1. Retain the working shared non-root Plesk API identity. Apply an operator-reviewed host filter to `omi-studio-api.service` only. The dedicated-UID nftables generator is an alternative deployment profile and must not be installed against a shared UID. Service IP filtering does not isolate same-UID filesystem/process access.
2. The host filter is partial: localhost and public Internet remain reachable. It is not a public destination allowlist. Every untrusted outbound HTTP path needs an application-level transport policy; database/proxy localhost exceptions are not HTTP permissions.
3. Keep `server/src/cloud/security/connectionPinnedHttp.ts` as the platform/infrastructure adapter. Validate every A/AAAA answer at the actual socket lookup, reject any nonpublic answer, preserve HTTPS hostname/SNI/certificate checks and reject automatic redirects. PKP manual same-origin redirect validation remains explicit per hop. OIDC, JWKS and Office downloads prohibit redirects. No domain model imports Node, DNS, systemd or this transport.
4. OIDC discovery is bound to the configured issuer (including the existing exact Microsoft tenant-template exception), with bounded metadata/token/UserInfo/JWKS bodies. Office callback downloads use the exact configured HTTPS origin, including its effective port; a matching configured custom port is allowed. Private IdP/Office addresses are unsupported by the production public-host policy. New exceptions require an explicit scoped design and tests, not a global bypass.
5. The PDF worker retains a separate identity, restricted AF_UNIX socket, no external network and bounded mounts/resources. POSIX job groups are terminated at timeout/parent exit. A deliberately escaped process session, Windows direct-child fallback and multi-host workers require separate analysis; this ADR does not certify them.
6. Record GitHub issue state, source/CI results, operator observations and exact-candidate manual receipts separately. #765 and #774 are closed as observed on 2026-11-02. Do not relabel them open solely because an older runbook is stale; do not manufacture a missing host receipt from closure. Reconcile existing evidence before requesting more host work. E02's workflow inventory, SHA/artifact binding and all manual gates remain unchanged.

No OMI schema/container/API route rename, DB migration, permission grant, editor restriction or runtime security weakening is introduced by this documentation repair. Every manuscript part remains editable.

## Alternatives

- UID-wide firewall on the present shared UID: affects other Plesk services and is rejected for this deployment.
- Service IP filter alone: permits localhost/public destinations and is insufficient against untrusted URL handlers.
- Dedicated API identity or outbound broker: valid future architecture if independent OS/filesystem authority or a controlled private-provider policy is required; unnecessary to replace the working topology for this repair.
- Universal public-only policy without per-connector redirect/identity checks: insufficient credential/origin protection.
- Issue closure or a green smoke test as RC approval: loses exact-candidate provenance and is rejected.

## Consequences and evidence

Keep existing renderers, login flows, store/domain ownership and PKP protocols. Document HTTPS/private-address/redirect compatibility before operator rollout; audit remaining HTTP/OAuth helpers separately. Preserve matched secure rollback, never unrestricted fetch or unisolated production parsing.

The operator supplies effective policy/cgroup identity, IPv4/IPv6 negative and positive-provider observations and controlled PDF timeout/recovery references with observed deployment SHA. The release owner binds accepted evidence to the exact candidate/build/file hashes through the existing `rc-evidence.mjs` receipt. Missing evidence blocks publication, not writing. Receipts may refer to access-controlled HTTPS records; never publish private manuscript text/title/filename/path, credentials, query tokens or raw host inventories.

The reviewed source passed 22 focused synthetic/mocked tests (runtime evidence, shared-UID/pinning, transport, Office, OIDC/JWKS), using existing installed dependencies. Candidate CI/lockfile validation and actual provider/host/device evidence remain independent.

Closed-issue evidence examples: [#774 quotas](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774#issuecomment-6559798888), [idle cleanup](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/774#issuecomment-6559820812), [#765 original staged policy](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765#issuecomment-6560592698). Last comments can describe earlier pending work; the final receipt must identify which later evidence supersedes them.

Implementation: [#822](https://github.com/open-manuscript-initiative/open-manuscript-studio/commit/0ad079914db439cca808f306b6cb67d3a2332b4e), [#819](https://github.com/open-manuscript-initiative/open-manuscript-studio/commit/dfeae517d64d42d6ce06508828d1d7a631009b37), [OIDC adoption](https://github.com/open-manuscript-initiative/open-manuscript-studio/commit/df4910066e78054e181b5d1e694c8ecf202a0051), [Office origin](https://github.com/open-manuscript-initiative/open-manuscript-studio/commit/f98c6e494266ec58354cb55866eaec10805df9ef).

Acceptance mapping: [security acceptance reconciliation](../server/security-acceptance-reconciliation.md).

## Revisit conditions

Private-network IdP/Office support, proxy/connection reuse, new outbound helpers, shared-UID trust changes, escaped worker sessions, native/Windows promotion, multi-host admission or altered RC evidence contracts.

Canonical EN/HU baseline checkpoint: [OMI security acceptance](https://openmanuscript.org/docs/governance/studio-1.0-architecture/security-acceptance-2026-11-02/).
