#!/usr/bin/env bash
# Retry only transient disk-image contention; never rebuild the application.
set -euo pipefail

target="${1:-}"
case "$target" in
  aarch64-apple-darwin|x86_64-apple-darwin) ;;
  *) echo 'Expected a macOS Rust target.' >&2; exit 2 ;;
esac

log_file="$(mktemp "${TMPDIR:-/tmp}/omi-dmg.XXXXXX")"
trap 'rm -f "$log_file"' EXIT

for attempt in 1 2 3; do
  echo "DMG packaging attempt $attempt/3 for $target"
  set +e
  npm run tauri -- bundle --target "$target" --bundles dmg --ci 2>&1 | tee "$log_file"
  statuses=("${PIPESTATUS[@]}")
  set -e

  # A logging failure must not be mistaken for a successful package.
  if [[ "${statuses[1]}" -ne 0 ]]; then
    exit "${statuses[1]}"
  fi
  status="${statuses[0]}"
  if [[ "$status" -eq 0 ]]; then
    exit 0
  fi

  if ! grep -Eq 'hdiutil: (create|attach|convert) failed - Resource busy' "$log_file"; then
    exit "$status"
  fi
  if [[ "$attempt" -eq 3 ]]; then
    echo 'DMG packaging still failed after three attempts.' >&2
    exit "$status"
  fi

  delay=$((attempt * 10))
  echo "Transient hdiutil contention; retrying DMG packaging in ${delay}s."
  sleep "$delay"
done
