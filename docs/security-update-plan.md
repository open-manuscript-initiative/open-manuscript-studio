# Security dependency update plan

- Refresh the npm lockfile so PostCSS resolves to a patched version (>= 8.5.23).
- Verify the resolved PostCSS version in CI before merge.
- Keep the glib alert separate because Tauri 2.11.5 currently depends on the gtk 0.18/glib 0.18 Linux stack; a direct glib 0.20 lockfile edit would not remove the vulnerable transitive dependency.
- Revisit the glib alert when the upstream Tauri Linux GTK dependency graph migrates to the patched gtk-rs generation.
