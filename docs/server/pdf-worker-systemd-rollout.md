# PDF isolation on Plesk / Ubuntu 24.04: controlled rollout

**Status: implementation staged, not installed or verified on the live VPS.** Do not close #774 based on a green CI run. #765 is already closed in GitHub, but separate API egress host-policy evidence is still necessary.

## Architecture

The Studio API submits bounded PDF-import and HTML-to-PDF-render requests over an AF_UNIX socket owned by systemd. No TCP worker port is opened. A separately owned non-root systemd service runs Poppler and Vivliostyle/Chromium. The API secrets and databases are not passed to this worker. Worker modules are installed under /opt/omi-pdf-worker, outside Plesk vhosts.

The example units enforce PrivateNetwork=yes, IPAddressDeny=any and IPAddressAllow=localhost (loopback only **inside** the worker's empty network namespace, for Chromium's internal resources), ProtectHome=yes, ProtectSystem=strict, inaccessible /var/www/vhosts, a 1 GiB temporary filesystem, cgroup memory limit 3 GiB, CPU limit 200%, task limit 128, and no elevated Linux capabilities. One shared worker limits tasks to two total and one per authenticated user across all API replicas on the **same host using this socket**. Input and output lengths and subprocess timeouts are bounded.

## 1. Prerequisites

- Take a tested IONOS VPS snapshot and record the deployed Studio SHA.
- Determine the exact API account using systemctl show omi-studio-api.service -p User -p WorkingDirectory. Do not share the API .env.
- Verify the Node binary (/opt/plesk/node/24/bin/node), Poppler (pdftotext), Vivliostyle (/usr/local/bin/vivliostyle), Chromium (/usr/bin/chromium), and required fonts.
- Check that the API's 127.0.0.1:3001 and collaboration's 127.0.0.1:3022 listeners work, and the external HTTPS /api/health returns 200.

## 2. Install on a test instance or maintenance window

Build from the **merged and reviewed** Studio code. Commands below are a starting example and must be adapted to the actual repository path and Unix identities.

~~~bash
sudo groupadd --system omi-pdf-clients
sudo useradd --system --no-create-home --shell /usr/sbin/nologin omi-pdf-worker
# Replace the placeholder with the actual service User, NOT root:
sudo usermod -aG omi-pdf-clients '<STUDIO_API_SERVICE_USER>'

cd /var/www/vhosts/openmanuscript.org/studio/repository
npm --prefix server run build

sudo install -d -o root -g root -m 0755 /opt/omi-pdf-worker
sudo install -d -o root -g root -m 0755 /opt/omi-pdf-worker/{workers,services,security}
printf '{"type":"module"}\n' | sudo tee /opt/omi-pdf-worker/package.json >/dev/null
for file in workers/pdfWorkerServer.js services/vivliostylePdfRenderer.js \
  security/pdfWorkerEnvironment.js security/pdfWorkerTransport.js; do
  sudo install -o root -g root -m 0644 \
    "server/dist/$file" "/opt/omi-pdf-worker/$file"
done

sudo install -m 0644 deployment/systemd/omi-pdf-worker.socket /etc/systemd/system/
sudo install -m 0644 deployment/systemd/omi-pdf-worker.service /etc/systemd/system/
sudo systemd-analyze verify /etc/systemd/system/omi-pdf-worker.socket \
  /etc/systemd/system/omi-pdf-worker.service
sudo systemctl daemon-reload
sudo systemctl enable --now omi-pdf-worker.socket
sudo systemctl start omi-pdf-worker.service
~~~

If any account/group already exists, verify it instead of recreating. Do not use chmod 666 on the socket, grant membership to arbitrary Plesk sites, mount API secrets into the worker, or disable network isolation to get Chromium running. For Chromium/font failures, correct only the specifically verified need.

## 3. Verify sandbox and functionality before switching the API

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

**Rollback:** remove/restore PDF_WORKER_SOCKET and PDF_WORKER_REQUIRED from the API configuration and restart only omi-studio-api.service. This temporarily restores the *unisolated* legacy path, so log the decision and reopen the security gate; do not claim #774 solved after rollback. Do not change nginx, firewall, PostgreSQL, MariaDB or unrelated Plesk applications.

## Explicit remaining gaps

- Worker-wide cgroup resource limits are not per-job cgroups. Timeout handling may leave grandchildren until the worker unit is stopped; verify process-tree cleanup and restart recovery.
- The one-worker quota spans only API replicas using the same Unix socket on one host. Multi-host clusters still need a distributed lease/queue.
- The API outbound policy against DNS rebinding at connection time for WebDAV/Nextcloud is **not implemented by this worker**. The #765 acceptance still requires host/proxy egress controls and actual IPv4/IPv6 tests.
- Docker/Compose still needs a separate isolated worker networking variant; this systemd unit is for the actual Ubuntu/Plesk host only.
- This does not automatically promote Draft specifications or approve the beta.13 public release.
