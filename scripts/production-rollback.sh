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
  current="$(git -C "$repo" rev-parse HEAD)"

  # Automatic rollback cannot undo a database migration. For any future PR
  # modifying migrations require an explicit database backup/manual rollout.
  migrations="$(git -C "$repo" diff --name-only "$previous" "$current" -- server/prisma/migrations server/prisma/identity/migrations)"
  if [[ -n "$migrations" ]]; then
    echo "Migration changes require a reviewed database backup and manual migration rollout:" >&2
    echo "$migrations" >&2
    exit 1
  fi
  [[ -d "$web" && -d "$repo/server/dist" ]] || {
    echo 'Cannot snapshot a live deployment: missing webroot or compiled API' >&2
    exit 1
  }
  [[ ! -e "$snapshot" ]] || { echo 'Snapshot directory already exists' >&2; exit 1; }
  (umask 077; mkdir -p "$snapshot/web" "$snapshot/server-dist")
  chmod 700 "$snapshot"
  printf '%s\n' "$previous" > "$snapshot/previous-sha"
  printf '%s\n' "$current" > "$snapshot/new-sha"
  rsync -a "$web/" "$snapshot/web/"
  rsync -a "$repo/server/dist/" "$snapshot/server-dist/"
  # Keep the restore script even when git reset removes it from the checkout.
  cp "${BASH_SOURCE[0]}" "$snapshot/rollback.sh"
  chmod 700 "$snapshot/rollback.sh"
  touch "$snapshot/snapshot-complete"
  echo "Rollback snapshot ready at $snapshot (previous $previous)."
  exit 0
fi

# Fail closed: never restore from a partial or tampered snapshot.
[[ -f "$snapshot/snapshot-complete" && -f "$snapshot/previous-sha" &&
   -d "$snapshot/web" && -d "$snapshot/server-dist" ]] || {
  echo "Incomplete rollback snapshot: $snapshot" >&2
  exit 1
}
previous="$(<"$snapshot/previous-sha")"
[[ "$previous" =~ ^[0-9a-f]{40}$ ]] || exit 1

echo "Restoring Studio production code and web/API assets to $previous."
# Preserve PostgreSQL, identity records, stored manuscripts, uploaded images,
# runtime .env files and certificates. No destructive database down-migration.
git -C "$repo" reset --hard "$previous"
export PATH="/opt/plesk/node/24/bin:/var/www/vhosts/openmanuscript.org/.nodenv/shims:$PATH"
if [[ "${STUDIO_ROLLBACK_SKIP_NPM:-0}" != 1 ]]; then
  (cd "$repo" && npm ci --include=dev)
  (cd "$repo/server" && npm ci --include=dev && npm run prisma:generate:all)
fi
rsync -a --delete "$snapshot/web/" "$web/"
rsync -a --delete "$snapshot/server-dist/" "$repo/server/dist/"
if [[ "${STUDIO_ROLLBACK_SKIP_RESTART:-0}" != 1 ]]; then
  restart_api
  curl --fail --silent --show-error --max-time 15 http://127.0.0.1:3001/api/health >/dev/null
fi
echo "Previous Studio web/API restored; databases and user data were left untouched."
