#!/usr/bin/python3
"""#765 staging-only network fixture runner; never accesses the real API cgroup.

Must run as root only inside a PrivateNetwork=yes transient systemd service.
All synthetic listeners belong to its own empty loopback-only namespace.
Drops to the omi-rc-builder UID before running the compiled Studio HTTP path.
"""
import json
import os
import pwd
import select
import socket
import subprocess
import sys
from pathlib import Path

FIXTURES = (
    ("loopback", socket.AF_INET, "127.0.0.1"),
    ("private_v4", socket.AF_INET, "10.243.241.1"),
    ("linklocal_v4", socket.AF_INET, "169.254.241.1"),
    ("ula_v6", socket.AF_INET6, "fd74::241"),
)

def fail(stage, reason="INCONCLUSIVE"):
    print(json.dumps({
        "scope": "separate-transient-service-cgroup",
        "stage": stage,
        "result": reason,
        "actualProductionApiCgroup": "NOT_TESTED",
        "ownerReleaseGate": "NOT_APPROVED",
    }, sort_keys=True))
    return 2

def command(*args):
    subprocess.run(args, check=True, stdout=subprocess.DEVNULL,
                   stderr=subprocess.DEVNULL, timeout=5)

def verify_isolation():
    if os.geteuid() != 0:
        raise RuntimeError("Root netns setup required")
    inode = os.environ.get("OMI_HOST_NETNS_INODE", "")
    if not inode.isdecimal() or os.stat("/proc/self/ns/net").st_ino == int(inode):
        raise RuntimeError("Host namespace not isolated")
    if {iface for _, iface in socket.if_nameindex()} != {"lo"}:
        raise RuntimeError("Unexpected interface in private namespace")
    cgroup = Path("/proc/self/cgroup").read_text(encoding="utf-8")
    if "omi-studio-api.service" in cgroup or "omi-765-app-stage-" not in cgroup:
        raise RuntimeError("Not in a dedicated staging cgroup")

def setup_synthetic_lo():
    command("/usr/sbin/ip", "link", "set", "lo", "up")
    command("/usr/sbin/ip", "-4", "addr", "add", "10.243.241.1/32", "dev", "lo")
    command("/usr/sbin/ip", "-4", "addr", "add", "169.254.241.1/32", "dev", "lo")
    command("/usr/sbin/ip", "-6", "addr", "add", "fd74::241/128", "dev", "lo")

def launch(stage):
    user = pwd.getpwnam("omi-rc-builder")
    if user.pw_uid == 0:
        raise RuntimeError("Staging account must not be root")
    source = stage / "scripts/acceptance/probe-staged-egress-app.mjs"
    compiled = stage / "server/dist/cloud/security/connectionPinnedHttp.js"
    webdav = stage / "server/dist/cloud/providers/webdav/WebDavProvider.js"
    if not all(path.is_file() for path in [source, compiled, webdav]):
        raise RuntimeError("Staged compiled source is missing")
    sockets = []
    try:
        for _name, family, address in FIXTURES:
            s = socket.socket(family, socket.SOCK_STREAM)
            s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            if family == socket.AF_INET6:
                s.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
            s.bind((address, 0))
            s.listen(2)
            sockets.append(s)
        args = ["/opt/plesk/node/24/bin/node", str(source), str(stage)]
        args.extend(str(s.getsockname()[1]) for s in sockets)
        completed = subprocess.run(
            args, cwd=stage, user=user.pw_uid, group=user.pw_gid,
            extra_groups=[], timeout=25,
            env={
                "PATH": "/opt/plesk/node/24/bin:/usr/bin:/bin",
                "NODE_ENV": "production",
                "OMI_ISOLATED_NETNS_VERIFIED": "true",
            }, stdin=subprocess.DEVNULL, capture_output=True, text=True,
        )
        try:
            report = json.loads(completed.stdout)
        except (ValueError, TypeError):
            return fail("compiled-transport-execution")
        # No raw stdout/stderr, hostnames, PIDs or addresses in the receipt.
        if not isinstance(report, dict):
            return fail("invalid-report")
        required = (
            "applicationTransport", "webdavApplicationPath",
            "privateIpv4Kernel", "linkLocalIpv4Kernel",
            "uniqueLocalIpv6Kernel", "loopbackKernelPositive",
        )
        if any(report.get(key) != "PASS" for key in required) or completed.returncode != 0:
            return fail("compiled-transport-denial")
        # No synthetic private listener must have received a connection.
        reached_private, _, _ = select.select(sockets[1:], [], [], 0)
        if reached_private:
            return fail("private-fixture-connected", "FAIL")
        print(json.dumps({
            "schemaVersion": 1,
            "scope": "separate-transient-service-cgroup",
            "compiledStudioHttpTransport": "PASS",
            "compiledStudioWebDav": "PASS",
            "privateV4KernelDeny": "PASS",
            "linkLocalV4KernelDeny": "PASS",
            "uniqueLocalV6KernelDeny": "PASS",
            "loopbackPositive": "PASS",
            "actualProductionApiCgroup": "NOT_TESTED",
            "actualProductionUserUrl": "NOT_TESTED",
            "ownerReleaseGate": "NOT_APPROVED",
            "result": "PASS",
        }, sort_keys=True))
        return 0
    finally:
        for s in sockets:
            s.close()

def main():
    stage_name = "preflight"
    try:
        if len(sys.argv) != 2:
            raise ValueError("Exactly one staging path is required")
        stage = Path(sys.argv[1]).resolve(strict=True)
        if not str(stage).startswith("/srv/omi-rc-staging/"):
            raise ValueError("Staging must be under /srv/omi-rc-staging")
        stage_name = "namespace-guard"
        verify_isolation()
        stage_name = "synthetic-interface-setup"
        setup_synthetic_lo()
        stage_name = "compiled-application-path"
        return launch(stage)
    except (OSError, ValueError, RuntimeError, subprocess.SubprocessError,
            subprocess.TimeoutExpired):
        return fail(stage_name)

if __name__ == "__main__":
    sys.exit(main())
