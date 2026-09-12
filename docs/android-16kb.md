# Android 16 KB memory page support

Play identified the arm64-v8a and x86_64 copies of
`libopen_manuscript_studio_lib.so` in versionCode 1009 as incompatible.

The application build script now passes both
`-Wl,-z,max-page-size=16384` and `-Wl,-z,common-page-size=16384`
to the final Android 64-bit cdylib link. Cargo target metadata is used because
the build script executes on the host. This applies to both direct APK and
Play AAB builds, including local builds. Other platforms and 32-bit builds
retain their existing link options.

The Android rebuild uses versionCode **1010**, with display version
0.1.0-beta.8. Run Android Release after merging. Existing signing configuration
and Play distribution behavior are preserved.

Before upload, CI inspects every packaged arm64-v8a and x86_64 shared library,
checking ELF LOAD alignment, address/offset congruence and the GNU_RELRO end.
It requires both Studio libraries and verifies that bundletool reports
PAGE_ALIGNMENT_16K for the preserved Play AAB. A failure blocks publication.

Local regression tests:
`python3 tests/android-page-size.test.py`

Final release validation still requires the signed Android build and a device
or emulator booted with 16 KB pages. Check `adb shell getconf PAGE_SIZE`
returns 16384, then test startup, opening/saving a manuscript, authentication
and returning from the background. Also test a normal 4 KB device.
The edge-to-edge warnings are a separate issue.

References:
- https://developer.android.com/guide/practices/page-sizes
- https://doc.rust-lang.org/cargo/reference/build-scripts.html#rustc-link-arg-cdylib
