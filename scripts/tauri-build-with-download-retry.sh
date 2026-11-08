#!/usr/bin/env bash
# Retry only temporary Tauri bundler HTTP failures, preserving all other failures.
set -euo pipefail

if [[ "$#" -eq 0 ]]; then
  echo 'Expected a build command.' >&2
  exit 2
fi

log_file="$(mktemp "${TMPDIR:-/tmp}/omi-tauri-download.XXXXXX")"
trap 'rm -f "$log_file"' EXIT

for attempt in 1 2 3 4; do
  echo "Tauri build attempt $attempt/4"
  set +e
  "$@" 2>&1 | tee "$log_file"
  statuses=("${PIPESTATUS[@]}")
  set -e
  if [[ "${statuses[1]}" -ne 0 ]]; then
    exit "${statuses[1]}"
  fi
  status="${statuses[0]}"
  if [[ "$status" -eq 0 ]]; then
    exit 0
  fi

  # Compilation, signing, checksum and installer errors must remain failures.
  if ! grep -Eq 'failed to bundle project:.*http status: (408|429|500|502|503|504)' "$log_file"; then
    exit "$status"
  fi
  if [[ "$attempt" -eq 4 ]]; then
    echo 'Tauri download still failed after four attempts.' >&2
    exit "$status"
  fi

  delay=$((attempt * 10))
  echo "Temporary bundler download failure; retrying in ${delay}s."
  sleep "$delay"
done
