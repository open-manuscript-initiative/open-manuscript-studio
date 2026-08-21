# Android launcher icon CI fix

The Android launcher icon must be generated only after `tauri android init` has created `src-tauri/gen/android`.

The release workflow now initializes the Android project first, then runs `npm run icons:generate`, and verifies the generated `mipmap-*` launcher assets before building the APK.

This prevents the default Tauri launcher icon from being packaged into release APKs.
