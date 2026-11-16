# Central Studio: privacy cleanup production activation evidence — 2026-11-16

**Scope:** The central `studio.openmanuscript.org` Plesk/Ubuntu 24.04 deployment only.
This record is based on the operator's **2026-11-16 terminal screenshots** and
the reviewed source implementation. It does not describe independently operated
institutional servers.

**Evidence classification:** Operator-provided terminal output, not an
independent authenticated SSH session. No production database records,
credentials, raw audit rows, or full system logs are attached to Git.

## Deployment and database preconditions

The operator reported PR [#923](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/923)
merged after [#922](https://github.com/open-manuscript-initiative/open-manuscript-studio/pull/922).
Their subsequent terminal screenshots show:

| Check | Reported outcome |
| --- | --- |
| Studio schema | Prisma `migrate status`: **40 migrations**, **database schema up to date** |
| Identity schema | Prisma `migrate status --config prisma.identity.config.ts`: **17 migrations**, **database schema up to date** |
| Studio API | `systemctl is-active omi-studio-api.service`: **active** |
| Audit cleanup dry-run | `npm run privacy:cleanup` returned `dry-run` and **audit backlog false** |

The first root shell showed a Node.js 18 Prisma CLI compatibility error;
the successful application-specific check was subsequently run under the
Plesk site's shell. The standard production deploy workflow explicitly
prepends `/opt/plesk/node/24/bin` to PATH. The cleanup service must use a
compatible Node.js runtime, not whichever `node` happens to be first in
the root interactive shell's PATH.

**Backup verification remains a separate item.** The provided screenshots
do not contain the `pg_dump`/manifest checksums or evidence of a full
restore drill. The reviewed deployment preflight requires protected Studio
and Identity backups for the approved additive index migration, but this
record does **not** claim those backups were independently verified.

## Manual production application: successful

At **2026-11-16 12:20:48–12:20:49 UTC**
(**13:20:48–13:20:49 Europe/Budapest**), the operator displayed:

```sh
journalctl -u omi-privacy-cleanup.service -n 30 --no-pager
```

The journal shows `npm run privacy:cleanup -- --apply`, the JSON report
with `mode: "apply"`, and systemd's **`Deactivated successfully`** /
**`Finished omi-privacy-cleanup.service`**. A `oneshot` service is
expected to become inactive after successful completion.

The report shows expired authentication records were processed. For all
four technical audit classes, **`candidates: 0`**, **`removed: 0`**,
**`remaining: 0`**, and **`backlog: false`**.
This is evidence of a successful real execution with no expired audit
records to remove on that date; it does **not** prove audit deletion against
old seeded records or that future timer firings will succeed.

## Daily timer: enabled and active

At **2026-11-16**, the operator provided output of:

```sh
systemctl is-enabled omi-privacy-cleanup.timer
systemctl is-active omi-privacy-cleanup.timer
systemctl list-timers --all omi-privacy-cleanup.timer
```

Observed results: **`enabled`**, **`active`**, and **one scheduled timer**.
The first announced firing was **2026-11-17 03:24:13 UTC**, or
**2026-11-17 04:24:13 CET** in Budapest.

The template uses `OnCalendar=*-*-* 03:15:00`,
`RandomizedDelaySec=20m`, `Persistent=true` and
`Unit=omi-privacy-cleanup.service`. The timer runs in the **server's
local time zone**, and the date/time displayed above is an observed
scheduled firing, **not** proof that the timer has already executed.
The screenshots show `LAST=-` in `list-timers`: first scheduled-run
acceptance must be done **after** the announced next firing.

## Live retention scope

| Record class | Default cleanup boundary |
| --- | --- |
| Expired sessions, password-reset tokens, invitations, passkey challenges, OAuth states (Identity and legacy Studio) | Expiration timestamp |
| `integration_audit_events` and `studio_module_audit_events` | Creation older than **90 days** |
| `admin_audit_events` and `collaboration_audit_events` | Creation older than **180 days** |

These are software/operator-configured retention thresholds, **not**
automatic legal determinations. The service does not purge manuscript
content, editorial events, scholarly peer-review provenance or separately
stored user-created translation variants. Pseudonymization/hashes do not
by themselves guarantee anonymity. Legal holds and backup retention require
separate operator processes.

**Different systems, different controls:** systemd journald/Plesk web-log
rotation does not remove database audit rows. The central Studio's actual
system journal retention must be verified independently; do not infer it
from an asserted seven-day web-log rotation.

## Post-activation checks

From the appropriate operator shell, confirm after **2026-11-17
03:24:13 UTC**:

```sh
systemctl is-enabled omi-privacy-cleanup.timer
systemctl is-active omi-privacy-cleanup.timer
systemctl list-timers --all omi-privacy-cleanup.timer
systemctl show omi-privacy-cleanup.service -p Result -p ExecMainStatus
journalctl -u omi-privacy-cleanup.service --since "2026-11-17 03:00:00 UTC" --no-pager
```

Expected: a fresh scheduled service start/finish, `Result=success`,
`ExecMainStatus=0`, zero outstanding audit backlog (unless a processing
limit legitimately requires another run), and a subsequent next-run
timestamp. A systemd `oneshot` service is **not** required to stay active.

**Failure recovery:** Do not immediately shorten retention or delete raw
tables. Check `systemctl status omi-privacy-cleanup.service` and
`journalctl -u omi-privacy-cleanup.service -n 80 --no-pager`, keep any
credentials/redacted personal data out of issues, validate the DB
connections/permissions and Node 24 PATH, run the default *dry-run* and
only then retry an approved `--apply` invocation. A failure can leave
partially processed stores; cleanup is designed to be rerunnable.

## Outstanding acceptance and governance items

- [x] Studio + Identity schema reported up to date; Studio API active
- [x] Successful manual **apply** execution; no expired audit backlog
- [x] Daily timer **enabled** and **active**; next scheduled firing visible
- [ ] Successful **first timer-triggered** execution after 2026-11-17 03:24:13 UTC
- [ ] Backup inventory, file integrity and independently tested restore evidenced in the restricted operations register
- [ ] Controller's live `OMI_PRIVACY_CONFIG_PATH` notice confirms actual logging purposes, legal basis, 90/180-day retention, external IdPs and backup handling (never paste the full operator file in a public issue)
- [ ] Regular monitoring owner and failure-alerting arrangement recorded

**Operational status as of 2026-11-16:** **enabled and manually exercised,
but the first unattended scheduled execution is not yet observed**.
Do not upgrade this to a completed end-to-end timer acceptance until the
next-run evidence is checked.
