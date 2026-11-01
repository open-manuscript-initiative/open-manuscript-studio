# Plesk / Ubuntu 24.04 — Studio API outbound firewall (#765)

**Status: source and tests prepared; no policy has been installed or verified on the live IONOS VPS.** Keep [#765](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/765) open as a release blocker until actual host acceptance is recorded. The generated rules are inert unless an authorized administrator deliberately installs them.

This procedure applies only to a dedicated non-root host-systemd `omi-studio-api.service` UID. It does not alter nginx, Apache, Plesk INPUT or SSH rules or the separate PDF worker. The PDF worker must retain its existing private network namespace, Unix socket and resource limits; see [PDF worker rollout](pdf-worker-systemd-rollout.md).

## 1. Threat and limits

The Studio API needs local PostgreSQL, an optional DNS stub and other Studio sockets. A blanket `IPAddressDeny=localhost` or global host OUTPUT DROP could interrupt the application. The proposed independently named nftables table, `inet omi_studio_api_egress`, matches the chosen service's **socket UID**, not all host users. It permits narrowly reviewed local IP/protocol/port tuples; rejects loopback, private, link-local, metadata, CGNAT and IPv6 transition ranges; permits explicitly approved public IP prefixes and ports; and rejects every other destination for that UID.

Rules include packet counters. Existing established-connection responses remain allowed for nginx → localhost API communication. Restarting the API after activation is necessary to discard any preexisting outbound sockets.

**Residual risk:** Allowing an internal DB socket for legitimate API operation means UID-level nft filtering cannot distinguish a database query from a user-controlled request that targets the same permitted socket. Every WebDAV and OJS/OMP user-controlled URL also needs connection-time DNS pinning or a separate broker/UID with **no local exceptions**. A green firewall probe alone does not prove this requirement. A dynamic provider/CDN IP allowlist needs an owner and refresh process; a strict IP allowlist does not automatically support arbitrary public WebDAV hosts.

## 2. Read-only inventory

Before editing a policy, take a tested IONOS VPS backup and open a second independent SSH session for rollback. Never put the production `.env`, credentials, usernames or full host firewall listing in public CI/issues.

~~~bash
sudo systemctl show omi-studio-api.service -p User -p Group -p MainPID -p ActiveState
sudo ss -tnp      # Privately record connections to PostgreSQL, DNS and other services
sudo ss -lntp     # Check API and collaboration listeners remain on 127.0.0.1
cat /etc/resolv.conf
sudo nft list tables
sudo systemctl show omi-pdf-worker.service -p User -p PrivateNetwork -p IPAddressDeny -p IPAddressAllow
~~~

Look up the real service account's numeric UID with `id -u <actual-service-account>` and examine whether **other Plesk sites/processes share that UID**. If it is shared, **stop**: this UID policy would affect unrelated services. A separate API identity or outbound broker must be implemented first. Root/empty service users are not supported.

Build a private inventory of actually used external destinations and internal ports: ORCID/OIDC, Google/Microsoft/Dropbox, authorized journal and WebDAV endpoints, mail relay, DeepL, Transkribus, archives and enabled research APIs. DNS and cloud-provider IPs can rotate. Do not trust a one-off `dig` output indefinitely.

## 3. Generate an offline policy (no firewall changes)

The repository's example profile contains `uid: 0` and is **deliberately invalid**. Copy and edit it outside Git, replace the illustrative endpoints, and protect the actual profile.

~~~bash
sudo install -d -m 0700 /root/omi-egress
sudo install -m 0600 deployment/egress/api-egress-TEMPLATE.json /root/omi-egress/profile.json
sudoedit /root/omi-egress/profile.json
# Run with Node 24, using the administrator's verified repository checkout.
sudo /opt/plesk/node/24/bin/node scripts/egress/generate-policy.mjs \
  --profile /root/omi-egress/profile.json \
  | sudo tee /root/omi-egress/candidate.nft >/dev/null
sudo chmod 0600 /root/omi-egress/candidate.nft
sudo nft --check --file /root/omi-egress/candidate.nft
/opt/plesk/node/24/bin/node --test tests/api-egress-policy.test.mjs
~~~

**All of these commands are read-only with respect to the firewall.** The generator refuses placeholder/root UIDs, nonpublic public destinations, overly broad IP prefixes, malformed ports, duplicate rules and local HTTP/HTTPS exemptions. It cannot discover or certify the actual firewall, and it does not update systemd or restart processes.

## 4. Controlled activation and immediate scoped rollback

Only proceed in a maintenance window after confirming dedicated UID, preserving the current firewall and obtaining approval for the exact local exceptions and public destination CIDRs. Confirm the dedicated table does not exist yet.

~~~bash
# Root-only audit record; do not upload it to public GitHub.
sudo nft list ruleset > /root/omi-egress/before-all.nft
sudo chmod 0600 /root/omi-egress/before-all.nft

# This one explicit command changes firewall state.
sudo nft --file /root/omi-egress/candidate.nft

# Confirm only this named table was added.
sudo nft list chain inet omi_studio_api_egress output
~~~

If login, database, WebDAV, mail, PKP or the public proxy fails, use the already open SSH recovery session. Do **not** flush or restore the whole Plesk nftables/iptables configuration.

~~~bash
sudo nft delete table inet omi_studio_api_egress
sudo systemctl restart omi-studio-api.service
curl -fsS --max-time 10 http://127.0.0.1:3001/api/health >/dev/null
curl -fsS --max-time 10 https://studio.openmanuscript.org/api/health >/dev/null
~~~

The draft rules are **not automatically persistent on reboot**. Do not enable the default nftables systemd unit or overwrite Plesk-managed firewall state without a separate persistence design and reboot rollback test.

## 5. Actual-host negative and positive acceptance

The read-only checker requires root to inspect nft kernel counters and then executes **no-credential** connection attempts under the *actual* API service identity. It tests both IP families and requires IPv4/IPv6 kernel deny counters to increase. A simple refused TCP connection without firewall counters does **not** count as evidence.

~~~bash
sudo env PATH=/opt/plesk/node/24/bin:/usr/bin:/bin \
  /opt/plesk/node/24/bin/node \
  scripts/egress/check-live-policy.mjs \
  --profile /root/omi-egress/profile.json \
  --approved-url https://approved-webdav-domain.example/
~~~

Substitute the actual approved HTTPS origin, **without credentials**. HTTP 401/403/405 proves endpoint transport, not valid user authentication. Check real authenticated WebDAV, PKP, OIDC, cloud and research integrations separately from test accounts. The script never writes returned HTML or metadata to stdout.

Minimum evidence linked to the exact deployed SHA:

- Negative under the live API UID: IPv4 127.0.0.2, 10.255.255.1, 169.254.169.254 and IPv6 ::1, fd00::1 are blocked by kernel counters.
- Positive: PostgreSQL/authentication, local DNS, collaboration/health, actual approved WebDAV (including authenticated upload/download), OJS/OMP workflows, authorized external provider APIs, and PDF render/import still work.
- DNS rebinding: a **controlled canary domain and server**, no private production data, proves that changing an A/AAAA result from approved public to local/metadata does not reach an internal HTTP endpoint, including redirect and IPv4-mapped/IPv6 cases. An allowed local DB tuple must not be reachable through a user-provided URL.
- Process isolation: prove the API UID is not shared, and verify separately any Docker/container network egress (container packets can traverse FORWARD rather than the host OUTPUT UID hook).
- Capture only timestamp, reviewed SHA, effective UID (privately), redacted allowlist version, PASS/FAIL outcomes, counters and tested rollback. Never upload secrets, authentication sessions or manuscript content.

If a test cannot be safely performed, mark it **NOT VERIFIED**, do not silently mark PASS. The PDF-worker #774 isolation and issue #271 GTK/glib advisory are separate controls.

## 6. CI assurance and limitations

The read-only `Studio API egress-policy contracts (#765)` workflow runs synthetic policy/missing-counter regression tests and an offline `nft --check` on Ubuntu. It **does not change the runner or production host firewall** and is not a substitute for running the acceptance script on the real VPS.

The current PR contains no automatic Plesk deployment, no root commands in CI, no schema migrations, no manuscript data changes and no native app version bump. Issue #765 remains open until actual host evidence and connection-time user-supplied URL protection are verified.
