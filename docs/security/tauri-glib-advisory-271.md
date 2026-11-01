# Linux Tauri GTK3 / glib advisory — issue #271

**Checked:** 2026-11-01 · **State:** open; inherited from the upstream GTK3 / WebKitGTK dependency graph. This document records the current security risk, not an assertion that it is fixed.

- Advisory: [RUSTSEC-2024-0429](https://osv.dev/vulnerability/RUSTSEC-2024-0429) / [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g).
- Affected Rust `glib` releases: `>=0.15.0 <0.20.0`; upstream fixed it in `0.20.0`.
- Failure mode: unsound `VariantStrIter` iterator operations, including the possibility of undefined behaviour / crashes when those methods are exercised; this is **not evidence of an exploit in Studio**.
- Locked Studio graph: `tauri 2.12.2`, `tauri-runtime-wry 2.12.1`, `wry 0.57.0`, `gtk 0.18.2`, `webkit2gtk 2.0.2`, `glib 0.18.5`.
- Platform scope: this GTK3/WebKitGTK chain is used by **Linux native desktop builds**. The shared `Cargo.lock` can include Linux-only dependencies when compiling Windows, macOS or mobile targets; do not mistake their presence in the lockfile for direct use on every target.
- Do not conflate this crate advisory with an operating-system `libglib2.0` package update. Installing newer OS GLib does **not** change the vulnerable Rust `glib 0.18.5` code linked into the application.

## Why there is no safe dependency-only fix yet

Tauri 2.x currently uses the gtk-rs 0.18/GTK3 family through Wry. Updating only the Rust `glib` dependency can leave the old 0.18 version alongside a new one; a Cargo.lock edit without a supported graph is **not remediation**. A private fork or unreviewed `[patch.crates-io]` backport is not appropriate for this beta without independent native Linux compatibility and safety verification.

Upstream tracked work as checked on 2026-11-01:

- [tauri#12561](https://github.com/tauri-apps/tauri/issues/12561), [#12562](https://github.com/tauri-apps/tauri/issues/12562), [#12563](https://github.com/tauri-apps/tauri/issues/12563): GTK4 migration issues **open**.
- [tauri#14684](https://github.com/tauri-apps/tauri/pull/14684): full GTK4/WebKitGTK 6 migration PR **open / unmerged**.
- [wry#1530](https://github.com/tauri-apps/wry/pull/1530) and [tao#1104](https://github.com/tauri-apps/tao/pull/1104): prerequisite migration PRs **open / unmerged**.

Therefore issue [OMI #271](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271) and the corresponding Dependabot advisory must remain open. The security work in issue #770 (Tauri CSP and EuroOffice WebView isolation) addresses a different threat model and does not repair `glib`.

## Automated regression and evidence

Run at any time:

```bash
node --test tests/tauri-glib-risk.test.mjs
node scripts/check-tauri-glib-risk.mjs
```

The normal command emits a GitHub Actions annotation and an Actions step summary while the **known upstream-blocked** `glib 0.18.x` dependency remains. It does not hide or suppress RustSec/Dependabot alerts.

The checker treats three states differently:

| State | Meaning | CI |
|---|---|---|
| `unresolved-upstream` | The documented GTK3 stack still has an affected `glib` | Explicit warning, beta CI may pass; issue stays open |
| `review-required` | A changed or incomplete Tauri/GTK stack still needs a new security decision | Fail CI |
| `candidate-fixed` | No affected `glib` remains in Cargo.lock | Do not close yet; verify native dependency tree and build |

The Linux native build also captures the actual reverse chain through `cargo tree --locked --target x86_64-unknown-linux-gnu --invert glib`. This is **not** the same as directly compiling `glib` only on other platforms.

A stricter manual or future stable-release gate is available:

```bash
node scripts/check-tauri-glib-risk.mjs --strict
```

It fails while the known issue remains. This intentionally **does not block normal beta CI** where the risk is explicitly tracked, but a production-quality Linux desktop distribution requires a separate explicit risk disposition or a fully patched GTK4 dependency graph. It would be misleading to claim Linux security clearance simply because general CI is green.

## Criteria for resolving issue #271

1. Obtain a supported stable Tauri/Wry/GTK dependency release using `glib >= 0.20`, or a properly reviewed, maintained security backport with equivalent assurance.
2. Regenerate `src-tauri/Cargo.lock` with Cargo (not by manually changing text).
3. Inspect Linux-target `cargo tree --locked --target x86_64-unknown-linux-gnu --invert glib`; **all** resolved `glib` copies must be outside the affected range.
4. Run the strict gate and the full Linux desktop build, including webview creation, EuroOffice iframe editing, open/save dialogs, manuscript editing and export, and installer round trip; then run Windows, macOS, Android and iOS CI.
5. Only after evidence is reviewed, resolve the Dependabot alert and close #271.

The existing weekly upstream Tauri-glib check may alert on upstream progress; this repository-side gate ensures that changes to **our own** locked graph cannot silently erase the risk record.
