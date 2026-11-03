#!/usr/bin/env bash
# Transient private systemd units ONLY; never restarts production units.
set -Eeuo pipefail
if [[ "$EUID" -ne 0 ]]; then echo "Root required" >&2; exit 2; fi
if [[ $# -ne 1 || ! "$1" =~ ^(egress|pdf|both)$ ]]; then
  echo "Usage: bash run-isolated-host-probes.sh egress|pdf|both" >&2; exit 2
fi
mode="$1"
source_dir="$(cd -- "$(dirname -- "$0")" && pwd -P)"
command -v systemd-run >/dev/null
test -x /usr/bin/python3
test -x /usr/sbin/ip
test -x /opt/plesk/node/24/bin/node
test -s "$source_dir/probe-private-net.py"
test -s "$source_dir/probe-pdf-timeout.mjs"
test "$(systemctl is-active omi-studio-api.service)" = active
test "$(systemctl is-active omi-pdf-worker.service)" = active
test "$(systemctl is-active omi-pdf-worker.socket)" = active
suffix="$(date -u +%s)-${BASHPID}"
# Resolve host namespace *outside* the restricted transient unit. Within the
# unit, inspecting PID 1's /proc namespace may need CAP_SYS_PTRACE and fail.
host_net_inode="$(stat -Lc '%i' /proc/1/ns/net)"
[[ "$host_net_inode" =~ ^[0-9]+$ ]] || {
  echo "Cannot establish trusted host net namespace inode" >&2; exit 2;
}

run_isolated() {
  systemd-run --wait --pipe --collect --service-type=exec \
    --setenv="OMI_HOST_NETNS_INODE=$host_net_inode" \
    --property="PrivateNetwork=yes" \
    --property="NoNewPrivileges=yes" \
    --property="ProtectSystem=strict" \
    --property="ProtectHome=yes" \
    --property="KillMode=control-group" "$@"
}

if [[ "$mode" == egress || "$mode" == both ]]; then
  allow="$(systemctl show -P IPAddressAllow omi-studio-api.service)"
  deny="$(systemctl show -P IPAddressDeny omi-studio-api.service)"
  for range in '10.0.0.0/8' '169.254.0.0/16' 'fc00::/7'; do
    [[ " $deny " == *" $range "* ]] || { echo "Missing API policy range: $range" >&2; exit 2; }
  done
  [[ " $allow " == *" 127.0.0.0/8 "* || " $allow " == *" localhost "* ]] || exit 2
  [[ " $allow " == *" ::1/128 "* || " $allow " == *" localhost "* ]] || exit 2
  echo "EGRESS BASELINE: private namespace without copied IP deny rules"
  run_isolated --unit="omi-egress-base-$suffix" \
    --property="PrivateTmp=yes" --property="MemoryMax=256M" \
    --property="TasksMax=64" \
    --property="CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW" \
    /usr/bin/python3 "$source_dir/probe-private-net.py" baseline
  echo "EGRESS FILTERED: cloned live API rules, separate cgroup"
  run_isolated --unit="omi-egress-filter-$suffix" \
    --property="PrivateTmp=yes" --property="MemoryMax=256M" \
    --property="TasksMax=64" \
    --property="CapabilityBoundingSet=CAP_NET_ADMIN CAP_NET_RAW" \
    --property="IPAddressAllow=$allow" --property="IPAddressDeny=$deny" \
    /usr/bin/python3 "$source_dir/probe-private-net.py" filtered
  test "$(systemctl show -P IPAddressAllow omi-studio-api.service)" = "$allow"
  test "$(systemctl show -P IPAddressDeny omi-studio-api.service)" = "$deny"
  echo "EGRESS ISOLATED CANARY: PASS (not direct live API-cgroup acceptance)"
fi
if [[ "$mode" == pdf || "$mode" == both ]]; then
  test -s /opt/omi-pdf-worker/security/pdfSubprocess.js
  test "$(id -u omi-pdf-worker)" -gt 0
  echo "PDF STAGING: installed executor in separate worker-UID service"
  run_isolated --unit="omi-pdf-canary-$suffix" \
    --property="User=omi-pdf-worker" --property="Group=omi-pdf-worker" \
    --property="PrivateDevices=yes" \
    --property="IPAddressDeny=any" --property="IPAddressAllow=localhost" \
    --property="InaccessiblePaths=-/var/www/vhosts" \
    --property="TemporaryFileSystem=/tmp:rw,nosuid,nodev,size=128M,mode=1777" \
    --property="MemoryMax=3G" --property="TasksMax=512" \
    --property="CPUQuota=200%" \
    --property="CapabilityBoundingSet=" --property="AmbientCapabilities=" \
    /opt/plesk/node/24/bin/node "$source_dir/probe-pdf-timeout.mjs"
  echo "PDF ISOLATED CANARY: PASS (not a live-worker timeout)"
fi
echo "DONE: no production units were restarted by this harness"
