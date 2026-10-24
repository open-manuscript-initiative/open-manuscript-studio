# Vendored Tauri deep-link plugin

This local crate is based on the upstream `tauri-plugin-deep-link` 2.6.2 source at:
https://github.com/tauri-apps/plugins-workspace/tree/deep-link-v2.6.2/plugins/deep-link

The Linux desktop-entry parser now explicitly disables the two options added to
`ini::ParseOption` in the newer `rust-ini` API. This preserves the plugin's
existing parsing behavior while allowing it to compile with the Tauri 2.12
dependency set. Keep the upstream license files alongside the copied source.
