# PDF worker subprocess credentials — first isolation boundary

The Studio API invokes two external utilities for user-supplied input: Poppler
`pdftotext` during PDF import and the Vivliostyle CLI/Chromium during PDF
publishing. Their processes previously inherited the entire API environment,
including PostgreSQL credentials, the integration master encryption key, OAuth
secrets and server registry credentials.

The security boundary introduced here passes a strict allowlist of routine
runtime variables instead:

- **Poppler:** executable lookup, system/Windows path basics, locale, timezone
  and temporary-directory settings.
- **Vivliostyle:** the above plus HOME/XDG user cache, font discovery and
  platform-specific user home settings used by Chromium and global node tools.

`DATABASE_URL`, OAuth client secrets, `INTEGRATION_MASTER_KEY`, registry
private keys, and `NODE_OPTIONS` never reach either subprocess through its
**inherited environment**. The allowlist is enforced at the actual
`execFile`/`spawn` callsites, not only at a frontend validation layer.
`npm run test:release-security` includes a synthetic child-process check.

## Operational limitations (issues #774 and #765)

**This is only credential-environment minimization, not an OS sandbox.**
Both workers still run with the API service's operating-system identity.
They may be able to read filesystem credentials, connect to the network, fork
children or consume CPU/memory if the host permits it. The Vivliostyle worker
still receives HOME for ordinary browser cache discovery; HOME is not an
isolation boundary.

To complete #774, deploy the workers under a separate locked-down identity or
container/worker process with least-privilege filesystem mounts, no access to
API `.env` / DB credential files, cgroup CPU/RAM/pid limits, per-job temp-dir
quotas and an outbound network deny policy. Preserve a legitimate font/cache
directory. Verify representative multilingual fonts, embedded images, native
renderer availability, Linux/Windows/macOS builds and published PDFs after the
transition. For installations with multiple API processes, the existing
process-local PDF import quotas in #772 also require distributed coordination.

To complete #765, implement and independently verify an outbound deny policy
for rendering/import workers plus a private/link-local/loopback/metadata egress
deny at actual connection time for user-configured API destinations. Keep
legitimate approved external storage/publisher integrations functional.

No host-level firewall, container or Plesk settings are changed in this PR.
