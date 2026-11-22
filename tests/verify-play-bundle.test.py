import contextlib
import io
import json
import os
from pathlib import Path
import runpy
import tempfile
import unittest
from unittest.mock import patch
import zipfile

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify-play-bundle.py"
GOOD = """<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    package="org.openmanuscript.studio" android:versionCode="1009">
    <application>
      <activity android:name="org.openmanuscript.studio.MainActivity">
        <intent-filter android:autoVerify="true">
          <action android:name="android.intent.action.VIEW"/>
          <category android:name="android.intent.category.DEFAULT"/>
          <category android:name="android.intent.category.BROWSABLE"/>
          <data android:scheme="https"/>
          <data android:host="app.openmanuscript.org"/>
          <data android:pathPrefix="/auth/orcid"/>
        </intent-filter>
        <intent-filter>
          <action android:name="android.intent.action.VIEW"/>
          <category android:name="android.intent.category.DEFAULT"/>
          <category android:name="android.intent.category.BROWSABLE"/>
          <data android:scheme="openmanuscript"/>
        </intent-filter>
      </activity>
    </application>
</manifest>"""
BAD = GOOD.replace("</manifest>", '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/></manifest>')

class PlayBundleTest(unittest.TestCase):
    def verify(self, manifests, expected_error=None):
        with tempfile.TemporaryDirectory() as directory:
            previous = Path.cwd()
            os.chdir(directory)
            try:
                output = Path("src-tauri/gen/android/app/build/outputs/bundle/release")
                output.mkdir(parents=True)
                with zipfile.ZipFile(output / "app.aab", "w") as archive:
                    for module in manifests:
                        archive.writestr(module + "/manifest/AndroidManifest.xml", b"fixture")
                Path("src-tauri/tauri.android.conf.json").write_text(json.dumps({
                    "bundle": {"android": {"versionCode": 1009}}}))
                def dump(command, **kwargs):
                    return manifests[command[-1].removeprefix("--module=")]
                with patch("subprocess.check_output", side_effect=dump), patch("sys.argv", ["verify", "bundletool.jar"]), contextlib.redirect_stdout(io.StringIO()):
                    if expected_error:
                        with self.assertRaisesRegex(SystemExit, expected_error):
                            runpy.run_path(str(SCRIPT), run_name="__main__")
                        self.assertFalse(Path("artifacts/play/app.aab").exists())
                    else:
                        runpy.run_path(str(SCRIPT), run_name="__main__")
                        self.assertEqual(Path("artifacts/play/app.aab").read_bytes(), (output / "app.aab").read_bytes())
            finally:
                os.chdir(previous)

    def test_verified_bundle_is_preserved(self):
        self.verify({"base": GOOD})

    def test_permission_in_base_is_rejected(self):
        self.verify({"base": BAD}, "Forbidden installation permission")

    def test_permission_in_feature_is_rejected(self):
        self.verify({"base": GOOD, "feature": BAD}, "Forbidden installation permission")

    def test_wrong_version_is_rejected(self):
        self.verify({"base": GOOD.replace("1009", "1008")}, "Unexpected Android versionCode")

    def test_wrong_package_is_rejected(self):
        self.verify({"base": GOOD.replace("org.openmanuscript.studio", "wrong.package")}, "Wrong Play package")

    def test_missing_verified_app_link_is_rejected(self):
        self.verify({"base": GOOD.replace('android:autoVerify="true"', 'android:autoVerify="false"')},
                    "Missing verified HTTPS ORCID App Link")

    def test_wrong_app_link_host_is_rejected(self):
        self.verify({"base": GOOD.replace('app.openmanuscript.org', 'example.org')},
                    "Missing verified HTTPS ORCID App Link")

    def test_wrong_app_link_path_is_rejected(self):
        self.verify({"base": GOOD.replace('android:pathPrefix="/auth/orcid"',
                                          'android:pathPrefix="/wrong"')},
                    "Missing verified HTTPS ORCID App Link")

    def test_combined_custom_scheme_and_https_filter_is_rejected(self):
        self.verify({"base": GOOD.replace('<data android:scheme="https"/>',
                                          '<data android:scheme="https"/><data android:scheme="openmanuscript"/>')},
                    "Missing verified HTTPS ORCID App Link")

    def test_missing_custom_scheme_fallback_is_rejected(self):
        self.verify({"base": GOOD.replace('<data android:scheme="openmanuscript"/>',
                                          '<data android:scheme="wrong"/>')},
                    "Missing isolated custom-scheme fallback")

    def test_missing_base_is_rejected(self):
        self.verify({"feature": GOOD}, "no base manifest")

if __name__ == "__main__":
    unittest.main()
