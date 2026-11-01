# PDF isolation on Plesk / Ubuntu 24.04: controlled rollout

> 2026-11-01: Production API calls now require the isolated socket even if `PDF_WORKER_REQUIRED=false`. Missing socket fails PDF processing closed; other editing stays available. The dedicated worker uses the local executor directly and must not set its own dispatch socket. Deploy/test the systemd units and ACL before enabling PDF use; source tests are not host acceptance.

**Status: implementation merged; actual VPS installation and sandbox acceptance remain separately required.** Do not close #774 or #765 based on a green CI run; both require deployment-specific evidence.

## Architecture

The Studio API submits bounded PDF-import and HTML-to-PDF-render requests over an AF_UNIX socket owned by systemd. No TCP worker port is opened. A separately owned non-root systemd service runs Poppler and Vivliostyle/Chromium. The API secrets and databases are not passed to this worker. Worker modules are installed under /opt/omi-pdf-worker, outside Plesk vhosts.

The worker and its Node-based CLI children both use Plesk Node 24: the unit pins both `ExecStart` and the leading `PATH` entry. An absolute Node 24 `ExecStart` alone does not control Vivliostyle’s `/usr/bin/env node` launcher; leaving `/usr/bin` first can still select the host’s Node 18.

The example units enforce PrivateNetwork=yes, IPAddressDeny=any and IPAddressAllow=localhost (loopback only **inside** the worker's empty network namespace, for Chromium's internal resources), ProtectHome=yes, ProtectSystem=strict, inaccessible /var/www/vhosts, a 1 GiB temporary filesystem, cgroup memory limit 3 GiB, CPU limit 200%, task limit 128, and no elevated Linux capabilities. One shared worker limits tasks to two total and one per authenticated user across all API replicas on the **same host using this socket**. Input and output lengths and subprocess timeouts are bounded.

## 1. Prerequisites

- Take a tested IONOS VPS snapshot and record the deployed Studio SHA.
- Determine the exact API account using systemctl show omi-studio-api.service -p User -p WorkingDirectory. Do not share the API .env.
- Verify the Node binary (/opt/plesk/node/24/bin/node), Poppler (pdftotext), Vivliostyle (/usr/local/bin/vivliostyle), **Google Chrome Stable** (/usr/bin/google-chrome-stable resolving to /opt/google/chrome/chrome on this Plesk host), and required fonts. The packaged default unit uses Google Chrome, not /usr/bin/chromium. Confirm the Chrome executable works under the isolated non-root service identity before switching the API.
- Check that the API's 127.0.0.1:3001 and collaboration's 127.0.0.1:3022 listeners work, and the external HTTPS /api/health returns 200.

## 2. Install on a test instance or maintenance window

Build from the **merged and reviewed** Studio code. Commands below are a starting example and must be adapted to the actual repository path and Unix identities.

~~~bash
# Run as root in a maintenance window with no active PDF jobs.
# A subshell stops at the FIRST error without closing the SSH shell.
(
set -euo pipefail
cd /var/www/vhosts/openmanuscript.org/studio/repository

# Root's default Node may be an old system binary. Use the same Plesk
# Node 24 runtime as the systemd worker; do not replace Ubuntu's Node.
omi_node_bin=/opt/plesk/node/24/bin
test -x "$omi_node_bin/node"
test -x "$omi_node_bin/npm"
"$omi_node_bin/node" --version
"$omi_node_bin/node" -e 'if (Number(process.versions.node.split(".")[0]) !== 24) { console.error("Plesk Node 24 is required for this deployment."); process.exit(1); }'

# Resolve the deployed service identity. Never copy a machine-specific
# Plesk username from an example, guess it from a directory name, or use root.
omi_api_user="$(systemctl show omi-studio-api.service --property=User --value)"
if [ -z "$omi_api_user" ]; then
  echo 'API service User= is empty; inspect the actual service before continuing.' >&2
  exit 1
fi
omi_api_user="$(id -un "$omi_api_user")"
if [ "$(id -u "$omi_api_user")" -eq 0 ]; then
  echo 'API service runs as root; resolve the service identity before continuing.' >&2
  exit 1
fi
id "$omi_api_user"

# Generate/compile as the API account, preserving repository file ownership.
# npm adds the local node_modules/.bin for tsc; dotenv reads server/.env.
# No database migration is run by this command.
runuser -u "$omi_api_user" -- env \
  PATH="$omi_node_bin:/usr/local/bin:/usr/bin:/bin" \
  "$omi_node_bin/npm" --prefix server run build

# Do not copy a stale or partial dist after a failed build.
for file in workers/pdfWorkerServer.js services/vivliostylePdfRenderer.js \
  security/pdfWorkerEnvironment.js security/pdfWorkerTransport.js; do
  test -s "server/dist/$file"
done

getent group omi-pdf-worker >/dev/null || groupadd --system omi-pdf-worker
getent group omi-pdf-clients >/dev/null || groupadd --system omi-pdf-clients
id -u omi-pdf-worker >/dev/null 2>&1 || \
  useradd --system --gid omi-pdf-worker --no-create-home --shell /usr/sbin/nologin omi-pdf-worker
usermod -aG omi-pdf-clients "$omi_api_user"
getent passwd omi-pdf-worker
id "$omi_api_user"

install -d -o root -g root -m 0755 /opt/omi-pdf-worker
install -d -o root -g root -m 0755 /opt/omi-pdf-worker/{workers,services,security}
printf '{"type":"module"}\n' > /opt/omi-pdf-worker/package.json
chmod 0644 /opt/omi-pdf-worker/package.json
for file in workers/pdfWorkerServer.js services/vivliostylePdfRenderer.js \
  security/pdfWorkerEnvironment.js security/pdfWorkerTransport.js; do
  install -o root -g root -m 0644 \
    "server/dist/$file" "/opt/omi-pdf-worker/$file"
done

install -m 0644 deployment/systemd/omi-pdf-worker.socket /etc/systemd/system/
install -m 0644 deployment/systemd/omi-pdf-worker.service /etc/systemd/system/
systemd-analyze verify /etc/systemd/system/omi-pdf-worker.socket \
  /etc/systemd/system/omi-pdf-worker.service
systemctl daemon-reload
systemctl enable --now omi-pdf-worker.socket
systemctl restart omi-pdf-worker.service
)
~~~

### Recover from the observed root-shell errors

`TypeError: ...styleText is not a function` with `Node.js v18.19.1` means the root shell used the old system Node for Prisma. It is not evidence of a schema or database migration failure. Rebuild with the explicitly selected Plesk Node 24 runtime above. Do not upgrade Ubuntu or replace the system Node as part of this fix.

`usermod: user ... does not exist` means the example Plesk account does not match this host. Determine it from the deployed service's `User=` and validate with `id`; do not create the guessed account. For an empty/root `User=`, inspect only:

~~~bash
systemctl show omi-studio-api.service -p User -p Group -p WorkingDirectory -p ExecStart
~~~

Do not publish `.env` contents. If the old instructions continued after the build error, neither copied files nor a start command proves a functioning worker. Repeat the guarded build/install block from its start, then perform section 3's socket, rendering and sandbox acceptance before switching/restarting the API. If the build reports permission errors, stop and inspect the particular owner/path; do not recursively chown the entire Plesk vhost or build as root to bypass the failure.

If any account/group already exists, verify its primary group and access rights instead of recreating it. Do not use chmod 666 on the socket, grant membership to arbitrary Plesk sites, mount API secrets into the worker, or disable network isolation or the Chrome sandbox merely to get rendering running. For Chrome/font failures, inspect the worker logs and correct only the specifically verified need. Chrome must work with its native sandbox under the dedicated worker account.

## 3. Verify sandbox and functionality before switching the API

The private `/tmp` tmpfs must explicitly set `mode=1777`. The observed deployment
returned HTTP 422 and `EACCES` from `mkdtemp('/tmp/omi-vivliostyle-...')` because
the dedicated worker could not write to its root-owned tmpfs. Set this mode on
the worker's `TemporaryFileSystem=` mount, keeping its size limit and
`nosuid,nodev` options. Do not change the host `/tmp` permissions or remove the
private mount. Restart the worker after updating its unit, then repeat both the
socket render and PDF-import smoke tests; this permission fix alone is not host
acceptance.

The subsequent host socket test timed out with `TasksCurrent=124`,
`TasksMax=128`, and `pids.events` reporting `max 5`, while memory usage was
approximately 312 MB against a 3 GiB limit. A direct CLI render in the worker's
mount/network namespaces succeeded, but that diagnostic process did not belong
to the worker's resource cgroup. These results identify task-limit exhaustion,
not proof of a renderer or network failure. Use the bounded `TasksMax=512`
setting in the unit; retain the two-job/one-per-owner admission limits and the
memory/CPU limits. Restart and repeat the actual socket render/import tests,
then measure peak tasks under two concurrent synthetic jobs and verify the
`pids.events` max counter does not increase. The value is provisional until
that host capacity test passes; never use unlimited tasks to pass acceptance.

**Observed host smoke result (2026-11-01):** after applying private tmpfs
`mode=1777` and `TasksMax=512`, the administrator ran a synthetic HTML render
through the actual `/run/omi-pdf-worker.sock` `/v1/render` endpoint, verified the
returned `%PDF-` signature, then submitted those bytes to `/v1/import` and
verified that the returned layout contained the synthetic `OMI` text. Both
checks reported OK. This confirms sequential socket render/import functionality
under the worker service, not full #774 security acceptance, concurrent-job
capacity, real-document fidelity, or Studio API/UI integration. Those remaining
checks must retain their own evidence before closing the deployment blocker.

~~~bash
systemctl is-active omi-pdf-worker.socket omi-pdf-worker.service
systemctl show omi-pdf-worker.service \
  -p User -p Group -p PrivateNetwork -p IPAddressDeny \
  -p NoNewPrivileges -p ProtectSystem -p ProtectHome \
  -p MemoryMax -p TasksMax
stat -c '%A %U %G %n' /run/omi-pdf-worker.sock
systemctl show omi-pdf-worker.service -p Environment
curl --silent --show-error --unix-socket /run/omi-pdf-worker.sock \
  -o /dev/null -w '%{http_code}\n' http://localhost/
~~~

The HTTP 404 response for an unsupported GET only proves the socket service is responding, **not** that its isolation works. Independently test network denial within the worker's network namespace, IPv4/IPv6 loopback/private/link-local/metadata destinations, malformed PDFs, forbidden external resource references, timeout and child-process cleanup, oversized input, available memory, publisher links, Unicode fonts and PDF rendering.

## 4. Enable isolated mode on the existing Studio API

Only after the worker is functioning, add these values to the **existing** API environment source (not to the worker):

~~~ini
PDF_WORKER_SOCKET=/run/omi-pdf-worker.sock
PDF_WORKER_REQUIRED=true
~~~

Restart only omi-studio-api.service so its process acquires the socket group membership. Verify the local and public HTTPS health endpoints (200), PDF import, PDF render, OJS integration, login and collaboration. Disconnect the socket in a test environment: the API must fail closed and NOT fall back to spawning the old parser.

**Rollback:** retain the isolated worker or temporarily disable PDF processing while restoring the previous reviewed API/worker configuration. In production, removing PDF_WORKER_SOCKET or setting PDF_WORKER_REQUIRED=false does not enable local processing. Never restore unisolated parsing as a service-availability workaround; keep #774 open until real acceptance. Do not change nginx, firewall, PostgreSQL, MariaDB or unrelated Plesk applications.

## Explicit remaining gaps

- Worker-wide cgroup resource limits are not per-job cgroups. Timeout handling may leave grandchildren until the worker unit is stopped; verify process-tree cleanup and restart recovery.
- The one-worker quota spans only API replicas using the same Unix socket on one host. Multi-host clusters still need a distributed lease/queue.
- The API outbound policy against DNS rebinding at connection time for WebDAV/Nextcloud is **not implemented by this worker**. The #765 acceptance still requires host/proxy egress controls and actual IPv4/IPv6 tests.
- Docker/Compose still needs a separate isolated worker networking variant; this systemd unit is for the actual Ubuntu/Plesk host only.
- This does not automatically promote Draft specifications or approve the beta.13 public release.

## Host-specific finding (2026-10-31)

The Ubuntu 24.04 IONOS/Plesk administrator verified Google Chrome Stable 156.0.8078.79 from Google's native amd64 .deb package. `google-chrome-stable` resolves through `/usr/bin/google-chrome-stable` to `/opt/google/chrome/chrome`; no `chromium` executable was found in the standard locations. The Chrome installation was performed as root, and package post-install scripts indicated a **pending kernel reboot**; defer that to a separate maintenance window. An APT warning about an invalidly suffixed MariaDB source-list filename is a separate packaging hygiene issue, not evidence that Chrome failed to install. Neither message is an instruction to run a global upgrade as part of this worker rollout.

Before the worker's first start, recheck the actual executable and test a small PDF render under the isolated systemd identity. A green GitHub CI run does not validate Chromium in this host's PrivateNetwork/ProtectSystem/PrivateDevices sandbox. Do not deploy the new production API for PDF use until the independent worker smoke test passes; production requires the socket independently of the optional flag.
