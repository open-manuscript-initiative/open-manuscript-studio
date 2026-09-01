# Security Policy

## Supported versions

Open Manuscript Studio is currently in alpha development. Security fixes are applied to the current development line and the most recent published prerelease. Older alpha builds should be upgraded rather than treated as supported long-term releases.

## Reporting a vulnerability

Please do not disclose exploitable security vulnerabilities in a public issue before maintainers have had a reasonable opportunity to investigate them.

Use GitHub's private vulnerability reporting / Security Advisory mechanism for this repository when available. If private reporting is not available, contact the Open Manuscript Initiative through the contact information published on the project's official website and clearly mark the message as a security report.

A useful report includes the affected version or commit, affected component, reproduction steps, expected and actual behavior, potential impact, and any suggested mitigation.

## Release and code-signing security

Official desktop releases must be produced from the official repository through the project's controlled CI/release workflow. Local or manually modified binaries are not official signed releases.

The project's code-signing requirements, trusted build provenance, signing roles, approval process, and verification requirements are documented in [Code Signing Policy](docs/CODE_SIGNING_POLICY.md).

Accounts with administrative, release, or signing privileges must use multi-factor authentication where supported. Signing credentials and service secrets must not be committed to the repository.

## Upstream dependency advisories

The Rust/Tauri desktop dependency graph currently contains `glib 0.18.5` on the Linux GTK/WebKit path. This version is affected by RUSTSEC-2024-0429 / GHSA-wrw7-89jp-8q8g (`glib::VariantStrIter` iterator unsoundness). The first non-vulnerable `glib` series is 0.20.x.

This is an upstream-blocked transitive dependency rather than an Open Manuscript Studio dependency that can be upgraded independently. Tauri 2.11.5 still resolves Linux `gtk`/`webkit2gtk` packages from the 0.18.x gtk-rs generation, so forcing `glib >= 0.20` would produce an incompatible dependency graph. Open Manuscript Studio does not call `glib::VariantStrIter` directly, but the affected crate remains part of the Linux desktop dependency graph and therefore the advisory is not considered fixed.

Dependabot is configured not to repeatedly attempt the impossible `glib 0.18.5 -> >=0.20` security update. The advisory must remain visible and must be re-evaluated when Tauri, WebKitGTK bindings, or the GTK Rust bindings move to a compatible non-vulnerable `glib` series. At that point the ignore entry in `.github/dependabot.yml` must be removed and the lockfile regenerated.

## Scope

Security reports may concern, among other areas, authentication and authorization, manuscript confidentiality, peer-review confidentiality, OJS/OMP integration, import/export processing, local file access, cloud-storage integrations, desktop packaging, dependency or supply-chain compromise, and release/signing infrastructure.
