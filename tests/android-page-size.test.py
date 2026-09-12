import importlib.util
from pathlib import Path
import shutil
import struct
import subprocess
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location("page_size", Path(__file__).resolve().parents[1] / "scripts/verify-android-page-size.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def elf(alignment=16384, machine=183, relro_end=32768):
    data = bytearray(176)
    data[:6] = b"\x7fELF\x02\x01"
    struct.pack_into("<H", data, 18, machine)
    struct.pack_into("<Q", data, 32, 64)
    struct.pack_into("<HH", data, 54, 56, 2)
    struct.pack_into("<IIQQQQQQ", data, 64, 1, 4, 0, 0, 0, 176, 176, alignment)
    struct.pack_into("<IIQQQQQQ", data, 120, 0x6474e552, 4, 0, 16384, 0, 0, relro_end - 16384, 1)
    return data


class PageSizeTest(unittest.TestCase):
    def test_both_architectures(self):
        for machine in (183, 62):
            module.verify_elf(elf(machine=machine), machine)

    def test_4kb_rejected(self):
        with self.assertRaisesRegex(ValueError, "LOAD alignment"):
            module.verify_elf(elf(alignment=4096), 183)

    def test_relro_rejected(self):
        with self.assertRaisesRegex(ValueError, "GNU_RELRO"):
            module.verify_elf(elf(relro_end=20480), 183)

    def test_corrupt_and_wrong_architecture(self):
        for data in (b"not ELF", elf()[:80], elf(machine=62)):
            with self.assertRaises(ValueError):
                module.verify_elf(data, 183)

    def test_incongruent_load_rejected(self):
        data = elf()
        struct.pack_into("<Q", data, 64 + 8, 4096)
        with self.assertRaisesRegex(ValueError, "congruent"):
            module.verify_elf(data, 183)

    def test_packaging(self):
        module.verify_bundle_config('{"alignment": "PAGE_ALIGNMENT_16K"}')
        for config in ('{}', '{"alignment": "PAGE_ALIGNMENT_4K"}'):
            with self.assertRaises(ValueError):
                module.verify_bundle_config(config)

    def test_archive_checks_all_libraries_and_missing_abis(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "test.aab"
            with zipfile.ZipFile(path, "w") as archive:
                for abi, machine in module.ABIS.items():
                    archive.writestr(f"base/lib/{abi}/libopen_manuscript_studio_lib.so", elf(machine=machine))
            module.verify_archive(path)
            with zipfile.ZipFile(path, "a") as archive:
                archive.writestr("feature/lib/arm64-v8a/libbad.so", elf(alignment=4096))
            with self.assertRaisesRegex(ValueError, "libbad.so"):
                module.verify_archive(path)
            with zipfile.ZipFile(path, "w") as archive:
                archive.writestr("base/lib/arm64-v8a/libopen_manuscript_studio_lib.so", elf())
            with self.assertRaisesRegex(ValueError, "Missing Studio"):
                module.verify_archive(path)

    @unittest.skipUnless(shutil.which("cc"), "C compiler unavailable")
    def test_real_linked_elf(self):
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "fixture.c"
            source.write_text("int counter = 1; int value(void) { return counter; }")
            for page, valid in ((4096, False), (16384, True)):
                target = Path(directory) / f"lib{page}.so"
                subprocess.run(["cc", "-shared", "-fPIC", str(source), "-o", str(target),
                                f"-Wl,-z,max-page-size={page}", f"-Wl,-z,common-page-size={page}"], check=True)
                data = target.read_bytes()
                machine = struct.unpack_from("<H", data, 18)[0]
                if valid:
                    module.verify_elf(data, machine)
                else:
                    with self.assertRaises(ValueError):
                        module.verify_elf(data, machine)


if __name__ == "__main__":
    unittest.main()
