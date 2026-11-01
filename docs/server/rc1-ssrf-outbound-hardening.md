# RC1 SSRF hardening: outbound integration HTTP

**Status: PR review only. No VPS firewall, systemd, Plesk or production configuration changes.**

## Threat addressed

The #822 connection-pinned WebDAV transport protects WebDAV/Nextcloud
operations. Other user-configurable outbound routes had separate DNS preflight
validation and then ordinary `fetch`; the peer could rebind from a public
address to loopback between these calls. In the current VPS deployment,
`omi-studio-api.service` permits loopback because PostgreSQL, the reverse
proxy, and collaboration depend on it. The systemd cgroup policy **cannot**
distinguish user-controlled HTTP from legitimate local database traffic.

## Code changes

`fetchPinnedPublicUrl` in
`server/src/cloud/security/connectionPinnedHttp.ts` preserves the public
endpoint's HTTPS hostname for Host/SNI/certificate validation, rejects
nonpublic A/AAAA answers at the actual TCP connection lookup, rejects
literal nonpublic IPs before connecting, disables automatic redirects and
makes each HTTP request use a fresh unshared socket. It supports
streaming `FormData` uploads (including DOCX) and ordinary JSON requests,
preserving `Response.url` for the OJS/OMP same-origin redirect state
machine.

All current user-configured outbound HTTP in OJS/OMP, reviewer form,
writeback, direct submission, WordPress/generic publication, and custom
AI paths has been routed through this transport. Manual OJS/OMP redirects
are still validated for the registered origin at each hop. Requests do
not forward credentials across origins.

## Acceptance (do not auto-promote RC1)

1. CI: typecheck/build, `test:release-security`, PKP environment tests
   for both supported OJS versions, reviewer writebacks and DOCX imports,
   security suite and CodeQL all pass on one reviewed main SHA.
2. Negative: private IPv4/IPv6, metadata IPs, public-to-private DNS
   rebinding, mixed public/private A/AAAA records, redirect to localhost,
   private literal hosts and IPv4-mapped IPv6 are denied.
3. Positive: test OJS/OMP submission, reviewer identities and writebacks,
   WordPress media/post publishing, custom AI endpoint and cloud
   WebDAV/Nextcloud from test identities, with credentials not logged.
4. Host: the effective `omi-studio-api.service` systemd BPF filter
   remains active, and PDF, PostgreSQL, OIDC, mail and public APIs still
   work. Do not test attacks against external infrastructure or real
   journals; use fixtures or authorized isolated services.
5. Still audit: configured OIDC/discovery/JWKS, OAuth cloud providers,
   EuroOffice callback downloads and any separate connector or helper
   that constructs a server-side URL. Some are fixed-provider destinations
   or private trusted service endpoints and need individual threat
   modeling rather than a blanket public-only policy.

A green PR or a closed #765 issue is not proof of the host-level
acceptance checks. Production CI/CD deploys main after merge; **leave
this PR draft until all checks and an operator-approved rollout are
recorded**. Do not change the already-working UID, PDF worker sandbox
or Plesk firewall to apply this code fix.
