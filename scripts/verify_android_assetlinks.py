#!/usr/bin/env python3
"""Fail a Google Play release if the *public* App Links association is broken.

The Play App Signing certificate is stable across ordinary versionCode updates.
Do not substitute the upload certificate or regenerate this value per release.
"""
import json
import sys
from urllib.request import Request, urlopen

URL = "https://app.openmanuscript.org/.well-known/assetlinks.json"
PACKAGE = "org.openmanuscript.studio"
PLAY_SIGNING_SHA256 = (
    "14:B1:C7:D7:0A:3D:47:6F:0A:14:71:D1:A9:FD:90:76:"
    "AF:1E:C6:DA:09:9F:45:48:60:0F:52:07:E1:D0:72:45"
)


def verify_association(document):
    if not isinstance(document, list):
        raise ValueError("Digital Asset Links must be a JSON array")

    for association in document:
        if not isinstance(association, dict):
            continue
        target = association.get("target")
        if not isinstance(target, dict):
            continue
        if (target.get("namespace") == "android_app"
                and target.get("package_name") == PACKAGE
                and "delegate_permission/common.handle_all_urls" in association.get("relation", [])
                and PLAY_SIGNING_SHA256 in target.get("sha256_cert_fingerprints", [])):
            return

    raise ValueError(
        "Public assetlinks.json does not authorize the Google Play signing "
        "certificate for org.openmanuscript.studio"
    )


def main():
    request = Request(URL, headers={"Accept": "application/json", "Cache-Control": "no-cache"})
    with urlopen(request, timeout=20) as response:
        if response.geturl() != URL:
            raise ValueError("assetlinks.json must be served without a redirect")
        if response.status != 200:
            raise ValueError(f"Unexpected assetlinks.json HTTP status: {response.status}")
        content = response.read(131073)
        if len(content) > 131072:
            raise ValueError("assetlinks.json response is too large")

    verify_association(json.loads(content))
    print(f"Verified published Play App Links: {URL} / {PACKAGE}")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, json.JSONDecodeError) as error:
        sys.exit(f"Google Play App Links verification failed: {error}")
