# #765 — one-command staging preflight

This is a **read-only preliminary check**, not an outbound network denial test.
It cannot generate a completed #765 acceptance receipt or authorize RC1.

## Usage

Run from the checked-out repository as a **non-root** operator, after confirming
that ports 3301 and 3302 belong to the dedicated isolated staging API:

```bash
cd /var/www/vhosts/openmanuscript.org/studio/repository
/opt/plesk/node/24/bin/node scripts/acceptance/765-staging-preflight.mjs
```

The command runs the existing offline receipt-validator unit tests and checks
HTTP 200 from **only** 127.0.0.1:3301 and :3302 `/api/health`.
It does not follow redirects, access the public Internet, modify services,
restart anything, alter firewall/BPF rules or access production application data.
It refuses to run as root.

The JSON contains source HEAD, SHA-256 of the configured staging
`/var/lib/omi-staging-api/app/server/dist/server.js` artifact (if readable),
and SHA-256 of the harness. These hashes are **inventory only**: they do not
prove the running PID loaded that artifact. Missing artifact is NOT_VERIFIED.
No environment variables, response bodies or credentials are printed.

`PREFLIGHT_PASS` means only that local health and receipt-unit tests passed.
DNS rebinding, SSRF, redirects, actual API cgroup negative-path, worker isolation,
approved integration workflows, boot persistence and operator authorization
remain **NOT_VERIFIED**. `hostEgressReceipt` stays NOT_APPROVED and RC stays NO_GO.

The separately approved synthetic fixture matrix and operator review in
[staging acceptance execution](765-staging-acceptance-execution.md)
are still required. Do not send real metadata, private IPs or production
manuscripts as test targets.

Test the new pure summary logic with:

```bash
node --test tests/765-staging-preflight.test.mjs
```
