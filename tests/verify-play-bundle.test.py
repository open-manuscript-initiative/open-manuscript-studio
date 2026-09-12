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
GOOD = '<manifest xmlns:android="http://schemas.android.com/apk/res/android" package="org.openmanuscript.studio" android:versionCode="1009"/>'
BAD = GOOD.replace("/>", '><uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/></manifest>')

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

    def test_missing_base_is_rejected(self):
        self.verify({"feature": GOOD}, "no base manifest")

if __name__ == "__main__":
    unittest.main()
