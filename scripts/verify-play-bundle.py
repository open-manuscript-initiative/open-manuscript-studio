"""Fail closed on the actual AAB manifest before publishing to Google Play."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import xml.etree.ElementTree as ET
import zipfile

ANDROID = "{http://schemas.android.com/apk/res/android}"


def has_view_link(root, scheme, *, host=None, path_prefix=None, require_verified=False):
    """Inspect the compiled AAB manifest, not just the Tauri source config."""
    for activity in root.findall(".//activity"):
        for intent_filter in activity.findall("intent-filter"):
            actions = {
                item.get(ANDROID + "name")
                for item in intent_filter.findall("action")
            }
            categories = {
                item.get(ANDROID + "name")
                for item in intent_filter.findall("category")
            }
            if "android.intent.action.VIEW" not in actions:
                continue
            if not {
                "android.intent.category.DEFAULT",
                "android.intent.category.BROWSABLE",
            }.issubset(categories):
                continue

            data = intent_filter.findall("data")
            schemes = {item.get(ANDROID + "scheme") for item in data
                       if item.get(ANDROID + "scheme") is not None}
            hosts = {item.get(ANDROID + "host") for item in data
                     if item.get(ANDROID + "host") is not None}
            prefixes = {item.get(ANDROID + "pathPrefix") for item in data
                        if item.get(ANDROID + "pathPrefix") is not None}
            if schemes != {scheme}:
                continue  # Do not mix HTTPS and a custom scheme in one filter.
            if host is not None and hosts != {host}:
                continue
            if host is None and hosts:
                continue
            if path_prefix is not None and path_prefix not in prefixes:
                continue
            if require_verified and intent_filter.get(ANDROID + "autoVerify") != "true":
                continue
            return True
    return False


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
        if not has_view_link(
            root, "https", host="app.openmanuscript.org",
            path_prefix="/auth/orcid", require_verified=True,
        ):
            raise SystemExit("Missing verified HTTPS ORCID App Link in Play AAB")
        if not has_view_link(root, "openmanuscript"):
            raise SystemExit("Missing isolated custom-scheme fallback in Play AAB")
print(f"Verified {bundle}: versionCode={expected_code}, no package installation permission")

# Preserve the verified AAB before a later APK build changes Gradle outputs.
destination = Path("artifacts/play")
destination.mkdir(parents=True, exist_ok=True)
shutil.copy2(bundle, destination / bundle.name)
