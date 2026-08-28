# glib Dependabot alert

The current Tauri 2.11.5 Linux dependency graph still uses gtk 0.18 / glib 0.18.x. The Dependabot alert recommends glib >= 0.20.0, but this cannot be resolved by a lockfile-only bump because Tauri 2.11.5 itself constrains the Linux GTK stack to gtk 0.18, which in turn requires glib 0.18.

Do not add a direct glib 0.20 dependency or hand-edit Cargo.lock: Cargo would keep the vulnerable glib 0.18 line for the GTK/Tauri dependency graph, so the alert would remain and the dependency tree could become inconsistent.

Track the upstream Tauri/GTK migration and update the application when Tauri provides a supported dependency graph using the patched gtk-rs/glib generation. Until then, treat this as an upstream-blocked moderate-severity transitive dependency and keep the rest of the Tauri stack current.
