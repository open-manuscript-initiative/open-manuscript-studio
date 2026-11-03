#!/usr/bin/python3
"""Isolated systemd canary. Never run outside a private network namespace."""
import json
import os
import socket
import subprocess
import sys

CASES = (
    ("localhost_v4", socket.AF_INET, "127.0.0.1", True),
    ("localhost_v6", socket.AF_INET6, "::1", True),
    ("rfc1918_v4", socket.AF_INET, "10.243.241.1", False),
    ("linklocal_v4", socket.AF_INET, "169.254.241.1", False),
    ("ula_v6", socket.AF_INET6, "fd74::241", False),
)

def verify_namespace():
    # Reading /proc/1/ns/net may require ptrace privileges that the test
    # unit deliberately does not have (CapabilityBoundingSet). When that
    # comparison is unavailable, fail closed unless *only* loopback exists.
    own_namespace = os.stat("/proc/self/ns/net").st_ino
    interfaces = {name for _, name in socket.if_nameindex()}
    if interfaces != {"lo"}:
        raise RuntimeError("Refused: test namespace contains non-loopback interfaces")
    try:
        host_namespace = os.stat("/proc/1/ns/net").st_ino
    except PermissionError:
        host_namespace = None
    if host_namespace is not None and own_namespace == host_namespace:
        raise RuntimeError("Host network namespace: refused")


def configure():
    if os.geteuid() != 0:
        raise RuntimeError("Transient CAP_NET_ADMIN account required")
    for cmd in (
        ("/usr/sbin/ip", "link", "set", "lo", "up"),
        ("/usr/sbin/ip", "-4", "addr", "add", "10.243.241.1/32", "dev", "lo"),
        ("/usr/sbin/ip", "-4", "addr", "add", "169.254.241.1/32", "dev", "lo"),
        ("/usr/sbin/ip", "-6", "addr", "add", "fd74::241/128", "dev", "lo"),
    ):
        subprocess.run(cmd, check=True, stdout=subprocess.DEVNULL,
                       stderr=subprocess.DEVNULL, timeout=5)

def reachable(family, host):
    with socket.socket(family, socket.SOCK_STREAM) as server:
        server.settimeout(2)
        if family == socket.AF_INET6:
            server.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 1)
        server.bind((host, 0))
        server.listen(1)
        port = server.getsockname()[1]
        with socket.socket(family, socket.SOCK_STREAM) as client:
            client.settimeout(2)
            try:
                client.connect((host, port))
                return True
            except (OSError, TimeoutError):
                return False

def run(mode):
    stage = "argument-validation"
    try:
        if mode not in ("baseline", "filtered"):
            raise ValueError("Mode must be baseline or filtered")
        stage = "namespace-verification"
        verify_namespace()
        stage = "interface-setup"
        configure()
        results = {}
        for name, family, host, allowed in CASES:
            stage = "connection-" + name
            actual = reachable(family, host)
            expected = True if mode == "baseline" else allowed
            results[name] = "PASS" if actual == expected else "FAIL"
        passed = all(value == "PASS" for value in results.values())
        print(json.dumps({"mode": mode, "checks": results, "result": "PASS" if passed else "FAIL"}, sort_keys=True))
        return 0 if passed else 1
    except (OSError, subprocess.SubprocessError, RuntimeError, ValueError) as exc:
        # Fixed phase names and exception classes only: no host identity or
        # potentially sensitive exception messages in CI/issue evidence.
        print(json.dumps({"result": "INCONCLUSIVE", "stage": stage, "reason": type(exc).__name__}))
        return 2

if __name__ == "__main__":
    sys.exit(run(sys.argv[1] if len(sys.argv) == 2 else ""))
