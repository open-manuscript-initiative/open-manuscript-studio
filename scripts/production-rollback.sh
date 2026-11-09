#!/usr/bin/env bash
# Rollback of a Plesk Studio deployment without rewriting manuscript databases.
# The snapshot is taken before npm ci/build, rsync, or service restarts. Its
# matching restore command runs automatically on a failed production deploy.
set -euo pipefail

usage() {
  echo "Usage: STUDIO_PREVIOUS_SHA=<old-commit> bash scripts/production-rollback.sh snapshot <snapshot-dir>" >&2
  echo "       bash <snapshot-dir>/rollback.sh restore <snapshot-dir>" >&2
  exit 2
}

action="${1:-}"
snapshot="${2:-}"
[[ "$action" == snapshot || "$action" == restore ]] || usage
[[ -n "$snapshot" && "$snapshot" == /* ]] || usage

repo="${STUDIO_REPOSITORY_DIR:-/var/www/vhosts/openmanuscript.org/studio/repository}"
web="${STUDIO_WEB_ROOT:-/var/www/vhosts/openmanuscript.org/studio/httpdocs}"
service="${STUDIO_API_SERVICE:-omi-studio-api.service}"

restart_api() {
  if systemctl restart "$service" 2>/dev/null; then return 0; fi
  if command -v sudo >/dev/null && sudo -n systemctl restart "$service"; then return 0; fi
  echo "Unable to restart $service; manual intervention required." >&2
  return 1
}

if [[ "$action" == snapshot ]]; then
  previous="${STUDIO_PREVIOUS_SHA:-}"
  [[ "$previous" =~ ^[0-9a-f]{40}$ ]] || { echo 'Missing verified previous commit SHA' >&2; exit 1; }
  git -C "$repo" cat-file -e "$previous^{commit}"
  # The deployment workflow can stream this helper from a not-yet-checked-out
  # commit, so it can snapshot before touching the working tree.
  current="${STUDIO_TARGET_SHA:-$(git -C "$repo" rev-parse HEAD)}"
  git -C "$repo" cat-file -e "$current^{commit}"

  # Never allow unreviewed migrations through an automatic code rollback.
  # Exception: ONE pinned, additive-only Android test applicant table migration.
  # Its schema is backwards compatible with the previous API (old code simply
  # ignores the table). Full DB dumps must be created and validated BEFORE
  # any npm install, Prisma migration or live-file update.
  approved_migration='server/prisma/migrations/20261109060000_android_closed_test_signups/migration.sql'
  approved_blob='dfc5ee96dc2cbc9bf2d1622ce494bd5b133e0bba'
  migration_changes="$(git -C "$repo" diff --name-status "$previous" "$current" -- server/prisma/migrations server/prisma/identity/migrations)"
  needs_db_backup=false
  if [[ -n "$migration_changes" ]]; then
    if [[ "$migration_changes" != "$(printf 'A\t%s' "$approved_migration")" ]] ||
       [[ "$(git -C "$repo" hash-object "$repo/$approved_migration")" != "$approved_blob" ]]; then
      echo "Migration changes require a reviewed database backup and manual migration rollout:" >&2
      printf '%s\n' "$migration_changes" >&2
      exit 1
    fi
    needs_db_backup=true
    echo 'Reviewed additive Android test migration verified against pinned Git blob.'
  fi
  [[ -d "$web" && -d "$repo/server/dist" && -d "$repo/server/node_modules" ]] || {
    echo 'Cannot snapshot: missing live webroot, compiled API, or runtime dependencies' >&2
    exit 1
  }
  # Never start the deploy without room for an exact pre-change runtime copy.
  # The previous node_modules are essential if npm packages change and a
  # network-independent rollback must restore the last working API.
  required="$(du -sb "$web" "$repo/server/dist" "$repo/server/node_modules" | awk '{sum += $1} END {print sum}')"
  available="$(df -B1 "$repo" | awk 'NR==2 {print $4}')"
  if [[ ! "$available" =~ ^[0-9]+$ || "$available" -lt "$((required + 104857600))" ]]; then
    echo 'Insufficient free disk space for a complete Studio runtime rollback copy' >&2
    exit 1
  fi
  [[ ! -e "$snapshot" ]] || { echo 'Snapshot directory already exists' >&2; exit 1; }
  (umask 077; mkdir -p "$snapshot/web" "$snapshot/server-dist" "$snapshot/server-modules")
  chmod 700 "$snapshot"
  printf '%s\n' "$previous" > "$snapshot/previous-sha"
  printf '%s\n' "$current" > "$snapshot/new-sha"
  if [[ "$needs_db_backup" == true ]]; then
    # This fail-closed operation must be allowed to use the database credentials
    # from server/.env. No password is echoed or written to the backup manifest.
    node "$repo/scripts/backup-reviewed-migration.mjs" "$repo" "$snapshot"
    [[ -s "$snapshot/database/studio.dump" &&
       -s "$snapshot/database/identity.dump" &&
       -s "$snapshot/database/manifest.json" ]] || {
      echo 'Pre-migration PostgreSQL backup validation failed.' >&2
      exit 1
    }
    printf '%s\n' "$approved_migration" > "$snapshot/reviewed-migration"
  fi
  rsync -a "$web/" "$snapshot/web/"
  rsync -a "$repo/server/dist/" "$snapshot/server-dist/"
  rsync -a "$repo/server/node_modules/" "$snapshot/server-modules/"
  # Keep the restore script even when git reset removes it from the checkout.
  cp "${BASH_SOURCE[0]}" "$snapshot/rollback.sh"
  chmod 700 "$snapshot/rollback.sh"
  touch "$snapshot/snapshot-complete"
  echo "Rollback snapshot ready at $snapshot (previous $previous)."
  exit 0
fi

# Fail closed: never restore from a partial or tampered snapshot.
[[ -f "$snapshot/snapshot-complete" && -f "$snapshot/previous-sha" &&
   -d "$snapshot/web" && -d "$snapshot/server-dist" &&
   -d "$snapshot/server-modules" ]] || {
  echo "Incomplete rollback snapshot: $snapshot" >&2
  exit 1
}
previous="$(<"$snapshot/previous-sha")"
[[ "$previous" =~ ^[0-9a-f]{40}$ ]] || exit 1

echo "Restoring Studio production code and web/API assets to $previous."
if [[ -f "$snapshot/reviewed-migration" ]]; then
  echo 'A reviewed additive migration may have run. Keeping the PostgreSQL schema and all user data unchanged.'
  echo 'Private pre-migration archives are available under the snapshot/database directory for a reviewed restore if ever needed.'
fi
# Preserve PostgreSQL, identity records, stored manuscripts, uploaded images,
# runtime .env files and certificates. No destructive database down-migration.
git -C "$repo" reset --hard "$previous"
# Restore the actual previous runtime bytes, not an npm ci approximation:
# a CDN outage or a changed npm registry cannot prevent this rollback.
rsync -a --delete "$snapshot/web/" "$web/"
rsync -a --delete "$snapshot/server-dist/" "$repo/server/dist/"
rsync -a --delete "$snapshot/server-modules/" "$repo/server/node_modules/"
if [[ "${STUDIO_ROLLBACK_SKIP_RESTART:-0}" != 1 ]]; then
  restart_api
  curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3001/api/health >/dev/null
fi
echo "Previous Studio web/API restored; databases and user data were left untouched."
