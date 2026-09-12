"""Fail closed on the actual AAB manifest before publishing to Google Play."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

bundles = list(Path("src-tauri/gen/android/app/build/outputs/bundle").rglob("*.aab"))
if len(bundles) != 1:
    raise SystemExit(f"Expected one Play AAB, found {len(bundles)}")
bundle = bundles[0]
expected_code = str(json.loads(Path("src-tauri/tauri.android.conf.json").read_text())["bundle"]["android"]["versionCode"])
android = "{http://schemas.android.com/apk/res/android}"
with zipfile.ZipFile(bundle) as archive:
    modules = [name.split("/")[0] for name in archive.namelist()
               if name.endswith("/manifest/AndroidManifest.xml")]
if "base" not in modules:
    raise SystemExit("AAB has no base manifest")
for module in modules:
    xml = subprocess.check_output([
        "java", "-jar", sys.argv[1], "dump", "manifest",
        "--bundle=" + str(bundle), "--module=" + module,
    ], text=True)
    root = ET.fromstring(xml)
    for element in root.iter():
        if element.get(android + "name") == "android.permission.REQUEST_INSTALL_PACKAGES":
            raise SystemExit(f"Forbidden installation permission in {module}")
    if module == "base":
        if root.get("package") != "org.openmanuscript.studio":
            raise SystemExit("Wrong Play package identifier")
        if root.get(android + "versionCode") != expected_code:
            raise SystemExit("Unexpected Android versionCode")
print(f"Verified {bundle}: versionCode={expected_code}, no package installation permission")

# Preserve the verified AAB before a later APK build changes Gradle outputs.
destination = Path("artifacts/play")
destination.mkdir(parents=True, exist_ok=True)
shutil.copy2(bundle, destination / bundle.name)
