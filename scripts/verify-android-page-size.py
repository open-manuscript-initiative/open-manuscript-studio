"""Inspect 64-bit ELF segments and AAB packaging before Android publication."""
import argparse
from pathlib import Path
import struct
import subprocess
import zipfile

PAGE = 16384
ABIS = {"arm64-v8a": 183, "x86_64": 62}


def verify_elf(data, machine):
    if len(data) < 64 or data[:6] != b"\x7fELF\x02\x01":
        raise ValueError("Expected a little-endian ELF64 library")
    if struct.unpack_from("<H", data, 18)[0] != machine:
        raise ValueError("ELF architecture does not match directory")
    offset = struct.unpack_from("<Q", data, 32)[0]
    size, count = struct.unpack_from("<HH", data, 54)
    if size < 56 or not count or offset + size * count > len(data):
        raise ValueError("Invalid ELF program header table")
    loads = 0
    for index in range(count):
        kind, _, file_offset, address, _, _, memory_size, alignment = struct.unpack_from(
            "<IIQQQQQQ", data, offset + index * size)
        if kind == 1:
            loads += 1
            if alignment < PAGE or alignment & (alignment - 1):
                raise ValueError(f"LOAD alignment {alignment} is not 16 KB compatible")
            if (address - file_offset) % PAGE:
                raise ValueError("LOAD virtual address and file offset are not congruent")
        if kind == 0x6474e552 and (address + memory_size) % PAGE:
            raise ValueError("GNU_RELRO end is not 16 KB aligned")
    if not loads:
        raise ValueError("No LOAD segments")


def verify_archive(path):
    found = set()
    with zipfile.ZipFile(path) as archive:
        for name in archive.namelist():
            parts = name.split("/")
            if len(parts) < 3 or parts[-3] != "lib" or parts[-2] not in ABIS or not name.endswith(".so"):
                continue
            abi = parts[-2]
            try:
                verify_elf(archive.read(name), ABIS[abi])
            except (ValueError, struct.error) as error:
                raise ValueError(f"{path}: {name}: {error}") from error
            if parts[-1] == "libopen_manuscript_studio_lib.so":
                found.add(abi)
            print(f"16 KB ELF verified: {name}")
    if found != set(ABIS):
        raise ValueError(f"Missing Studio 64-bit libraries: {set(ABIS) - found}")


def verify_bundle_config(config):
    if '"PAGE_ALIGNMENT_16K"' not in config:
        raise ValueError("AAB does not request PAGE_ALIGNMENT_16K")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("directory", type=Path)
    parser.add_argument("--bundletool", required=True)
    args = parser.parse_args()
    bundles = list(args.directory.rglob("*.aab"))
    if len(bundles) != 1:
        raise ValueError(f"Expected one AAB, found {len(bundles)}")
    bundle = bundles[0]
    verify_archive(bundle)
    config = subprocess.check_output([
        "java", "-jar", args.bundletool, "dump", "config", "--bundle=" + str(bundle),
    ], text=True)
    verify_bundle_config(config)
    print(f"16 KB ELF and AAB packaging verified: {bundle}")


if __name__ == "__main__":
    main()
