#!/usr/bin/env bash
# #774 isolated stage-only API/AF_UNIX worker outage and recovery acceptance.
# No production services, production socket, network firewall or secrets touched.
set -Eeuo pipefail

if [[ "$EUID" -ne 0 || $# -ne 2 ]]; then
  echo "Usage (root): bash run-pdf-api-failclosed-staging.sh STAGING_REPO_ROOT REVIEWED_SHA" >&2
  exit 2
fi
stage="$(realpath -- "$1")"
expected="$2"
[[ "$expected" =~ ^[a-f0-9]{40}$ ]] || { echo "Expected 40-character reviewed SHA" >&2; exit 2; }
case "$stage" in
  /var/www/vhosts/*|/opt/omi-pdf-worker*|/root/*)
    echo "Refusing live/Plesk or root-private path as staging checkout" >&2; exit 2 ;;
esac
test -f "$stage/tests/pdf-worker-api-failclosed.test.mjs"
test -f "$stage/tests/fixtures/pdf-worker-staging-stub.mjs"
test -s "$stage/server/dist/routes/publicationPdfRoutes.js"
test -s "$stage/server/dist/services/vivliostylePdfRenderer.js"
test -s "$stage/server/node_modules/express/index.js"
test "$(git -C "$stage" -c safe.directory="$stage" rev-parse HEAD)" = "$expected"
# Reject stale compiled renderers mapping a missing socket to HTTP 422.
grep -Fq 'Isolated PDF worker is temporarily unavailable.' \
  "$stage/server/dist/services/vivliostylePdfRenderer.js"

# The staging test must NOT run with the live API's identity: that account
# may have access to production .env/DB and Plesk vhost material.
stage_user=omi-rc-builder
test "$(id -u "$stage_user")" -gt 0
test "$(id -Gn "$stage_user")" = "$stage_user"
api_user="$(systemctl show -P User omi-studio-api.service)"
test -n "$api_user"
test "$stage_user" != "$api_user"
test "$(systemctl is-active omi-studio-api.service)" = active
test "$(systemctl is-active omi-pdf-worker.service)" = active
test "$(systemctl is-active omi-pdf-worker.socket)" = active
runuser -u "$stage_user" -- test -r "$stage/tests/pdf-worker-api-failclosed.test.mjs"
runuser -u "$stage_user" -- test -r "$stage/server/dist/services/vivliostylePdfRenderer.js"

suffix="$(date -u +%s)-$BASHPID"
systemd-run --wait --pipe --collect --service-type=exec \
  --unit="omi-pdf-api-stage-$suffix" \
  --property="User=$stage_user" \
  --property="Group=$stage_user" \
  --property="InaccessiblePaths=-/var/www/vhosts -/opt/omi-pdf-worker -/run/omi-pdf-worker.sock" \
  --property="PrivateNetwork=yes" \
  --property="IPAddressDeny=any" \
  --property="IPAddressAllow=localhost" \
  --property="PrivateTmp=yes" \
  --property="PrivateDevices=yes" \
  --property="NoNewPrivileges=yes" \
  --property="ProtectSystem=strict" \
  --property="ProtectHome=yes" \
  --property="KillMode=control-group" \
  --property="MemoryMax=768M" \
  --property="TasksMax=96" \
  --property="TimeoutStartSec=90s" \
  --setenv="OMI_PDF_STAGE_SERVER_ROOT=$stage/server" \
  /opt/plesk/node/24/bin/node \
  --experimental-test-module-mocks \
  --test "$stage/tests/pdf-worker-api-failclosed.test.mjs"

test "$(systemctl is-active omi-studio-api.service)" = active
test "$(systemctl is-active omi-pdf-worker.service)" = active
test "$(systemctl is-active omi-pdf-worker.socket)" = active
echo "PDF STAGING API FAIL-CLOSED: TEST COMPLETE (check 0 failed above)"
