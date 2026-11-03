# #765 and #774 — isolated systemd host acceptance

Status: review-only, operator execution required. This proposal adds test tools;
it does not change Studio API/PDF services, Plesk identities, nftables, any
permanent systemd unit, user manuscripts, or RC releases.

## Previously verified

- #765: API active, correct cgroup, systemd ingress/egress BPF attachment,
  loopback and public API health HTTP 200, and 8/8 SSRF/rebinding code tests.
- #774: dedicated worker and Unix socket restrictions, live synthetic
  render/import after updating its deployed five-module bundle, source regression
  6/6, and 5/5 compiled module comparison.
- These observations do NOT prove live IP denial or production timeout recovery.

## Execution model

The operator first reviews this PR and its checks, then copies the three
scripts from the exact reviewed SHA into a unique root-owned directory under
/run with directory mode 0755 and files mode 0644. Verify each file's Git blob
SHA. Do not pull or reset the production checkout, which can contain locally
modified release-branch material. Run from a separate approved maintenance
session with IONOS backup and separate recovery SSH connection.

Run, only from that verified temporary directory:

    bash run-isolated-host-probes.sh egress
    bash run-isolated-host-probes.sh pdf

No normal GitHub CI runner has access to the real production systemd and kernel
policies. CI checks only script syntax and safety invariants, not live outcomes.

### #765 — paired connectivity control

The egress test creates two distinct transient units, not children of the live
API. Each has PrivateNetwork=yes, separate cgroup, limited CPU/task/memory
resources, no credentials, and a no-new-privileges policy. The probe *refuses*
to configure an interface if it detects the host network namespace. It assigns
synthetic addresses exclusively to its private namespace loopback interface.

The first unfiltered BASELINE must reach 127.0.0.1, ::1, 10.243.241.1,
169.254.241.1 and fd74::241 via temporary local TCP listeners. An unreachable
baseline is INCONCLUSIVE, not security proof. The second unit copies the
effective IPAddressAllow and IPAddressDeny properties from the running Studio
API unit. It MUST reach loopback and MUST fail to connect to the three known
reachable denied destinations. IPv6 disabled, missing CAP_NET_ADMIN, missing
systemd BPF attachment or incorrect policy results in FAIL/INCONCLUSIVE, never
an assumed PASS. The API unit is not restarted and its policy is rechecked
for non-modification afterward.

This is evidence for behavior of a temporary cgroup running copied rules,
not direct proof of each actual production API socket. The live IP cgroup policy
attachment, positively tested internal DB/proxy and authorized external
integrations, connection-time DNS rebinding canaries and additional reserved
IPv6/IPv4 families must be documented separately. No arbitrary public sites
or production journals are probed by this harness.

### #774 — stage-only child tree timeout and recovery

The PDF canary executes as the existing omi-pdf-worker user under a new,
transient non-root service with PrivateNetwork, PrivateDevices, private /tmp,
read-only filesystems, inaccessible vhosts, no capabilities, and the same
3 GiB/512-task/200% CPU ceilings as the live worker. It dynamically imports
the *currently installed* process group executor from /opt/omi-pdf-worker.
A synthetic Node parent starts a grandchild; a bounded forced timeout must
terminate both, after which a new synthetic process must finish successfully.
The live PDF socket and running service are never intentionally blocked.
Transient test cleanup relies on KillMode=control-group.

This does not demonstrate behavior against processes deliberately escaping
their POSIX session or prove that a client sees fail-closed behavior after
real live-worker failure. Verify that separately using a staging API/worker.
The test script cannot make a credentialed publishing call.

### Logging, receipts and RC

Capture sanitized results and date, exact reviewed source SHA, exact deployed
module hashes, environment/namespace boundaries, positive and negative results,
unverified attack classes, owner approval and an evidence reference under
the already-existing RC host-egress and host-pdf-sandbox manual gates. Reject
inconclusive results; do not invent pass records. Keep #765/#774 release-blocker
until owner acceptance of host evidence on the actual RC candidate SHA.
No RC tag, release, or server restart should be triggered by this PR.

## Operational guardrails

- systemd-run creates ephemeral services, not persistent units. PrivateNetwork
  means the synthetic IP addresses belong to test namespaces, not the host.
- If any baseline fails, do NOT disable systemd policies or increase production
  privileges to make it pass. Stop and review journal locally.
- Never apply the UID-based nftables generator to the shared Plesk UID.
- Never upload credentials, raw host inventories, private manuscript contents,
  journal IDs or full provider URLs with query tokens.
- A green source CI means the scripts parse, not that the host was tested.
