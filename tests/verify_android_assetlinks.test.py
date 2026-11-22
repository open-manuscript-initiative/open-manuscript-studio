"""Regression tests for the public Play signing certificate association."""
import importlib.util
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().parents[1] / "scripts/verify_android_assetlinks.py"
SPEC = importlib.util.spec_from_file_location("omi_verify_assetlinks", SCRIPT)
assert SPEC and SPEC.loader
verifier = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(verifier)


def correct_association():
    return [{
        "relation": ["delegate_permission/common.handle_all_urls"],
        "target": {
            "namespace": "android_app",
            "package_name": verifier.PACKAGE,
            "sha256_cert_fingerprints": [
                "AA:" * 31 + "AA",
                verifier.PLAY_SIGNING_SHA256,
            ],
        },
    }]


class AssetLinksTest(unittest.TestCase):
    def test_play_and_direct_certificates_are_accepted(self):
        verifier.verify_association(correct_association())

    def test_missing_google_play_certificate_is_rejected(self):
        data = correct_association()
        data[0]["target"]["sha256_cert_fingerprints"] = ["AA:" * 31 + "AA"]
        with self.assertRaisesRegex(ValueError, "Google Play signing"):
            verifier.verify_association(data)

    def test_wrong_package_is_rejected(self):
        data = correct_association()
        data[0]["target"]["package_name"] = "org.other.app"
        with self.assertRaisesRegex(ValueError, "Google Play signing"):
            verifier.verify_association(data)

    def test_missing_relation_is_rejected(self):
        data = correct_association()
        data[0]["relation"] = []
        with self.assertRaisesRegex(ValueError, "Google Play signing"):
            verifier.verify_association(data)

    def test_invalid_json_shape_is_rejected(self):
        with self.assertRaisesRegex(ValueError, "JSON array"):
            verifier.verify_association({})


if __name__ == "__main__":
    unittest.main()
