# Studio API listener binding — Plesk and container deployments

## Scope and security boundary

The Studio Node.js API supports an explicit `API_BIND_HOST` listener setting. The historical default is `0.0.0.0` to avoid silently breaking existing deployments. The setting is strictly validated; the only accepted values are `0.0.0.0`, `127.0.0.1`, `::` and `::1`.

For the **Plesk Ubuntu 24.04 installation of studio.openmanuscript.org**, the administrator verified the effective nginx route configuration on 2026-10-31. API integrations proxy to `http://127.0.0.1:3001` and collaboration WebSockets to `127.0.0.1:3022`. The public `https://studio.openmanuscript.org/api/health` endpoint returned HTTP 200; local `http://127.0.0.1:3001/api/health` returned HTTP 200. The external mobile-network test to the server IPv4 port 3001 timed out; that test alone does not prove the port is universally unreachable.

The Plesk service `omi-studio-api.service` is managed through systemd and uses working directory `/var/www/vhosts/openmanuscript.org/studio/repository/server`. Its listener was previously `0.0.0.0:3001`; the service's current network exposure is additionally controlled by the host firewall.

**The source change does not update the live systemd service or server secrets.** Do not set `API_BIND_HOST=127.0.0.1` until the updated server build is deployed and all Plesk nginx proxy upstreams have been checked. Do not change the WebSocket host or the Plesk nginx configuration.

### Controlled Plesk rollout

1. Save a tested backup/snapshot, note the currently deployed git SHA and preserve the existing `.env` and systemd service definition. Keep SSH/Plesk management access independent of the Studio.
2. After the PR is merged and deployed, add `API_BIND_HOST=127.0.0.1` to the actual configuration source consumed by `omi-studio-api.service`. In a dotenv-based deployment, the `.env` is under the service's `WorkingDirectory`. Do not print, paste or commit the file; it contains credentials. Avoid duplicate keys and ensure systemd does not override the variable.
3. Restart only the Studio API service in a maintenance window: `sudo systemctl restart omi-studio-api.service`.
4. Verify **both** local bindings and the public proxy:
   - `sudo ss -lntp | grep -E ':(3001|3022)[[:space:]]'` — expect `127.0.0.1:3001` and `127.0.0.1:3022`, no `0.0.0.0:3001`.
   - `curl -fsS http://127.0.0.1:3001/api/health` — local API health.
   - `curl -fsS https://studio.openmanuscript.org/api/health` — public HTTPS proxy.
   - Test account login, OJS integrations, the accepted collaboration invitation and two-client WebSocket reconnect through HTTPS.
5. If any required request fails, immediately restore the previous `API_BIND_HOST` value (or omit the variable, restoring `0.0.0.0`), restart `omi-studio-api.service` and repeat the health and live-collaboration tests. Investigate safely from `systemctl status omi-studio-api.service` or `journalctl -u omi-studio-api.service -n 60 --no-pager` (redact any secrets before sharing).
6. Record the deployed commit SHA, timestamps, local/public test results, and signed-off rollback capability in the change record. Only then consider the listener-hardening component complete.

### Docker and institutional installations

The portable `deployment/compose.yml` sets `API_BIND_HOST: 0.0.0.0` explicitly. The API and web containers communicate on their internal Compose network; `127.0.0.1` **inside the API container** would prevent the web container from reaching it. Retain the published frontend reverse-proxy protections, secrets and network separation. Other institutional installations may select a loopback or a deliberately published listener based on their actual routing topology.

### Scope of Issue #765 and #774

Listener loopback hardening is **inbound** reduction only. It does **not** limit outbound API requests, solve DNS rebinding at connection time, make PDF import/render subprocesses unprivileged, or enforce resource limits. **Do not close #765 or #774 based on this PR.** Dedicated workers, egress policy and actual host acceptance tests remain separately required.

### Local regression commands

```bash
npm --prefix server run test:api-bind-host
npm --prefix server run typecheck
```

Do not assume a green unit test proves the Plesk deployment configuration has been updated.
