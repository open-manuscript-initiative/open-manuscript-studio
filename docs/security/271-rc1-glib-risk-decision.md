# #271 — RC1 Linux Tauri / Rust glib exception decision (owner worksheet)

> **2026-11-03: PENDING / no owner exception granted.** Do not close
> [#271](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271),
> dismiss Dependabot or claim that the advisory is fixed. A green CI is not a
> security exception. This record contains no owner signature.

## Exactly which risk?

- Advisory [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)
  / [GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g),
  affecting the Rust \`glib\` \`VariantStrIter\` iterator implementation.
- Upstream **Rust glib >=0.20.0 is patched**; the problem is the *compatible
  Tauri 2/GTK3/WebKit dependency graph*, which still resolves vulnerable Rust
  \`glib 0.18.5\`. **Do not say no patched glib version exists.**
- Last confirmed repository chain in [#271](https://github.com/open-manuscript-initiative/open-manuscript-studio/issues/271):
  Tauri 2.12.2 / runtime-wry 2.12.1 / Wry 0.57.0 /
  GTK 0.18.2 / webkit2gtk 2.0.2 / **glib 0.18.5**. Confirm on the *actual
  candidate SHA*; package graph might change later.
- This Rust crate warning is not remediated by updating Ubuntu's OS GLib
  package or manually overwriting a \`Cargo.lock\` entry.
- Upstream migration [Tauri #14684](https://github.com/tauri-apps/tauri/pull/14684),
  [Wry #1530](https://github.com/tauri-apps/wry/pull/1530),
  [Tao #1104](https://github.com/tauri-apps/tao/pull/1104)
  is the supported-direction dependency; do not merge forked GTK4 branches
  directly into a released Studio.
- Affected functions are \`glib::VariantStrIter::{next,nth,last,next_back,nth_back}\`.
  A *direct Studio source grep returning no matches* is useful but **does not
  prove** the native GTK/WebKit transitive call graph has no reachable usage.
  Do not declare the issue unexploitable without a reviewed reachability claim.

## Local bounded technical evidence (read only)

For the **exact reviewed candidate**, in a separate trusted checkout with the
correct Rust/Cargo toolchain:

~~~bash
node scripts/check-tauri-glib-risk.mjs
cargo tree --manifest-path src-tauri/Cargo.toml --locked \
  --target x86_64-unknown-linux-gnu --invert glib
~~~

The known \`unresolved-upstream\` result is **expected warning evidence, not a
PASS**. Save the minimal crate/version tree digest in approved internal records.
No need to rebuild all platforms solely for this risk inventory.

## All five policy criteria required for a time-limited exception

The accepted [1.0 blocker policy](../release/1.0-blocker-policy.md) requires
all five; if any item is unknown, choose **NO-GO** for Linux Stable.

| Criterion | Required proof | Current decision |
| --- | --- | --- |
| 1. No compatible fixed stack | Current reviewed Tauri/Wry/GTK stable dependency and upstream release versions checked; distinguish fixed crate from compatible stack | **PENDING** |
| 2. No known reachable application path | Owner/security reviewer examines direct and transitive \`array_iter_str\` / \`VariantStrIter\` uses in the actual Linux native dependency tree, including WebKit/GTK code paths. Absence of a Studio direct call is insufficient | **PENDING** |
| 3. Available mitigations enabled | Document trusted content/WebView restrictions, fixed native navigation + CSP, allowed URI origins, signed artifacts and executable containment; identify what does and does not mitigate \`VariantStrIter\` unsoundness | **PENDING** |
| 4. Owner and review date | Named authorized risk owner, UTC approval date and **future** review deadline with an escalation trigger when supported migration lands or reachability changes | **PENDING** |
| 5. Public limitation | Explicit published Linux native support note acknowledges inherited \`glib 0.18.5\` warning; does not pretend zero known advisories or fixed crate | **PENDING** |

**Decision (select exactly one only with actual owner authorization):**

- [ ] **TEMPORARY EXCEPTION:** all five points above have reviewed evidence,
  risk owner and fixed revisit date, Linux native remains Stable with public
  limitation. The security alert and issue #271 stay **open** while vulnerable.
  Link exception to RC source SHA and owner-signed \`security-review\`.
- [ ] **CHANGE SCOPE:** Linux native becomes Preview/unsupported **only** via
  an explicit approved Route A scope/policy change, updated public compatibility
  page, and a reviewed change to the mandatory \`linux-device\` RC gate; do not
  silently bypass that gate to publish.
- [ ] **NO-GO:** retain Linux Stable and stop RC1 until compatible upstream fix
  (or defensible backport) or the above exception is actually approved.

**Current selection: NO-GO (no signature or exception evidence recorded).**

Decision fields: reviewer **PENDING** · UTC timestamp **PENDING** · candidate
SHA **PENDING** · reachability evidence **PENDING** · mitigations **PENDING** ·
public statement **PENDING** · next review date **PENDING**.

## Suggested public statement — only if the exception is actually signed

> The OMI Studio Linux desktop build inherits Rust \`glib 0.18.5\` through the
> Tauri 2 GTK3/WebKit stack, which is affected by RUSTSEC-2024-0429. Upstream
> Rust glib versions >=0.20 are fixed, but the currently supported Studio
> Linux dependency stack has not migrated. The risk and upstream migration
> are monitored; the advisory is not marked resolved. Linux support remains
> subject to the published scope and the dated security decision.

This is **draft text, not an approved product claim**. Keep the exact current
source/version and document date correct when publishing.

## Escalation / expiration

Reopen the decision immediately when a supported Tauri/Wry GTK4 stack becomes
available, a native call path is discovered, a relevant advisory changes
severity or a new security incident occurs. **Expiration may not be invented
by CI**. Preserve any earlier \`cargo-audit\`/Dependabot findings in evidence.
