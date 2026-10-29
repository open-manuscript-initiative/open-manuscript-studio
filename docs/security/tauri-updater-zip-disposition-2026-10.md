# Tauri updater ZIP dependency disposition (October 2026)

## Vulnerability

The `zip` 4.6.1 package is a transitive dependency of
`tauri-plugin-updater` 2.14.0 through the default `zip` feature.
Dependabot cannot install the fixed ZIP 9.x series, because that
upstream updater dependency still requires ZIP 4.x.

The upstream feature description explicitly states that `zip` is for
compressed updater bundles from Tauri v1. Studio's current Tauri bundle
configuration does **not** set `createUpdaterArtifacts: "v1Compatible"`.
The current public release contains direct executable/installable
artifacts (`.exe`, `.msi`, `.AppImage`, `.dmg`, etc.), and does not
publish a legacy ZIP updater archive.

The updater is therefore compiled without the optional `zip` feature,
but keeps `rustls-tls` and `system-proxy`. The signed
`download_and_install` flow remains part of the code. **If the Studio
starts publishing ZIP/tarball-based updater artifacts or
`v1Compatible` bundles, re-enable support only after selecting a
patched ZIP dependency and testing all desktop update paths.**

## Verification

- `npm run test:release-security` checks the cargo feature selection.
- Tauri desktop and release CI must prove compilation with
  `default-features = false`.
- On a Rust build host: run `cargo tree -i zip --manifest-path
  src-tauri/Cargo.toml` and confirm the insecure archive package
  is not reachable. Check whether any old Cargo.lock entry remains:
  keeping a stale lock entry does **not** imply the vulnerable code
  is compiled; prefer regenerating the lockfile after Cargo feature
  changes.
- Run signed Windows/macOS/Linux updater integration smoke tests
  before shipping a release; no production desktop update was
  carried out by this change.

## Unrelated Linux dependency risk

`glib` 0.18.5 remains in the GTK3/WebKitGTK graph of Tauri Linux.
The fix requires `glib >= 0.20` but the GTK3 binding family uses
0.18.x. Dependabot's existing `glib` ignore is explicit and is why
its security update job says `all_versions_ignored`. Do not
remove that ignore to manufacture a green status; resolve through
an upstream GTK stack upgrade or a separately validated backport.
