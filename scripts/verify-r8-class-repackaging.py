#!/usr/bin/env python3
from pathlib import Path
import sys

root = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("src-tauri/gen/android/app/build/outputs/mapping")
mappings = list(root.rglob("mapping.txt"))
if not mappings:
    raise SystemExit(f"R8 mapping.txt is missing under {root}")

mapping = mappings[0]
targets = []
for raw in mapping.read_text(encoding="utf-8", errors="replace").splitlines():
    if raw.startswith((" ", "#")) or " -> " not in raw or not raw.endswith(":"):
        continue
    target = raw.split(" -> ", 1)[1][:-1].strip()
    if target:
        targets.append(target)

unnamed = [target for target in targets if "." not in target]
if not unnamed:
    raise SystemExit(
        "No class was mapped into the unnamed package. "
        "AGP 9.1 R8 class repackaging was not observed."
    )

print(f"R8 class repackaging verified: {len(unnamed)} of {len(targets)} mapped classes use the unnamed package.")
print("Examples:", ", ".join(unnamed[:10]))
