# Publication performance review — 2026-11-27

The recent changes produce a measurable improvement in the synthetic desktop diagnostic. They do not yet make large-document publication editing consistently responsive. No runtime performance patch is included in this review; the accompanying change repairs the measurement harness and adds a missing long-document title workload.

The [follow-up implementation and measurements](publication-inactive-editor-2026-11-27.md) address inactive author-view synchronization in PR #1098. The historical measurements and findings below describe the runtime before that follow-up.

## Scope and environment

Reviewed the adaptive projection/cache work (#1042/#1043), facing-page stabilization integrated by #1049, and publication batches #1061 and #1070. Runtime comparison:

- Before: `c30622383e91923e077107e2a49f6f39d305530c`, before #1043.
- After: `bbcbd00aa6e6cae9b2b6eb54d55927e56519dad6`, containing both performance batches and subsequent features.
- Same shared Linux x86_64 host (AMD EPYC 9V74), Node 24.22.3, Chromium executable 158.0.8127.0, 1440 × 900 viewport, one Playwright worker, no retries, Vite development server. The emulated Desktop Chrome user agent in the raw data is distinct from the actual executable/host.
- Identical synthetic text, 30 characters with 20 ms requested inter-key delay. The focus repair was applied to both revisions; dependency lockfiles differ only in the application version.
- One run per workload/version. Other features also differ between revisions: this comparison cannot isolate an individual PR's contribution or establish a statistically reliable speedup.

[Machine-readable measurements](publication-review-2026-11-27.json) retain all samples, status and limitations. No private manuscript content is included.

## Results

Times are milliseconds. Median/p95 measure keydown to the second animation frame, a paint proxy. Opening is driver-observed open-to-caret time; the benchmark can overlap initial pagination and does not isolate a fully warmed layout.

| Workload | Before median / p95 | After median / p95 | Before / after open-to-caret |
| --- | ---: | ---: | ---: |
| Empty document title | 35.6 / 117.4 | 28.1 / 56.3 | 285.8 / 258.5 |
| 100 blocks, single-page body | 461.1 / 2138.1 | 271.4 / 430.1 | 1830.9 / 1934.6 |
| 400 blocks, single-page body | 1200.3 / 2091.6 | 554.5 / 870.2 | 6503.7 / 9606.6 |
| 400 blocks, facing-page body | 1219.6 / 2047.4 | 573.4 / 731.9 | 6895.3 / 9207.6 |
| 1000 blocks, facing-page body | Test exceeded 180 s | 1070.5 / 1711.2 | Incomplete test / 10864.4 |
| 1000 blocks, facing-page title | Not measured | 901.1 / 1050.3 | Not measured / 16469.3 |

The timed-out baseline attached 30 numeric samples, preserved as diagnostic data. Its failed overall status is not accepted as a passing benchmark. All six after-workloads passed. Blocks are paragraphs in this fixture, not physical page counts.

The single-run opening measurements are mixed, with higher opening times for the 400-block cases. Opening and editing therefore need separate acceptance budgets and repeated measurements. Even after the improvement, 1000-block body and title input retain approximately one-second median latency in this development environment.

## Findings

### P1 — The inactive author editor still processes every publication edit

[App.tsx](../../src/App.tsx) keeps `EditorPane` mounted alongside the publication menu. External section updates rebuild the author's serialized document in [ContinuousManuscriptEditor.tsx](../../src/components/ContinuousManuscriptEditor.tsx); [BlockEditor.tsx](../../src/components/BlockEditor.tsx) then parses, compares and applies the incoming document with `setContent`.

A separate instrumented 100-block diagnostic typed ten characters into the publication editor:

| Editor | Document-changing transactions | Full-document replacements |
| --- | ---: | ---: |
| Inactive author editor | 10 | 10 |
| Active publication editor | 10 | 0 |

The document size was 30,702 ProseMirror positions. This confirms duplicate editing work remains despite the active editor's local-snapshot optimization. In the separate CPU sample, native `removeChild` and `getBoundingClientRect` dominated self time; this does not assign all sampled cost to one component, but supports prioritizing DOM work over further numeric-only optimization.

Recommended next repair: defer/coalesce projection and editor synchronization for inactive views, then refresh on activation while preserving selection, editor history and formatting behavior. Canonical OMI updates and saving must remain immediate. Replacing the author editor without preserving its state would not satisfy that requirement.

### P1 — Incremental numeric pagination still follows a complete main-thread DOM pass

[PublicationDocumentCanvas.tsx](../../src/components/PublicationDocumentCanvas.tsx) collects all flow elements on each pass and traverses them in measurement chunks. Cached line geometry avoids some work, but block bounds, widths, anchors and presentation output are still processed across the document. Only the subsequent numeric pagination runs in the worker.

The worker and checkpoint changes are real; they do not establish dirty-range DOM measurement or full view virtualization. The remaining 1000-block input latency and repeated long tasks show that further main-thread work reduction is needed. Prioritize dirty block/suffix measurement and publication projection after inactive-editor synchronization is addressed. Retain cold-versus-incremental layout equivalence and semantic editing coverage.

### P2 — The original benchmark could not measure body typing

The body locator identifies a non-focusable paragraph. Calling `target.press('End')` after clicking it blurs the enclosing contenteditable host in the observed Playwright path. Subsequent keystrokes target the page body and produce zero samples. The title-only textarea path succeeds, so it does not reveal the body-path defect.

The repair sends End through `page.keyboard` and verifies the actual editable host remains focused. The extended 1000-block title workload also exposes a gap in the original empty-document title case. The benchmark remains opt-in and has no machine-dependent CI timing threshold; a green ordinary CI run does not establish performance.

### P2 — Device, memory and note-heavy acceptance remain outstanding

These browser timings cover synthetic text in a development build. They do not establish Android/WebView behavior, production-build latency, long citation/footnote workloads or total process memory. The adaptive cache tracks estimated optional data, not native PSS, canonical document memory, undo history or all DOM-related caches. JS heap snapshots in the raw data must not be promoted to minimum/recommended Android RAM requirements.

## Correctness checks

- 190 existing targeted tests passed across continuous snapshots, cache budgets, projection/event integrity, notes, proofing, section numbering, page styles/geometry/navigation and incremental pagination.
- An additional deterministic investigation compared 240 cold and cached pagination outputs, with seed 12457, across changed block geometry, keep-with-next rules and footnote heights in fixed and styled modes. All outputs matched; this bounded sample is not exhaustive verification.
- Six repaired/extended browser benchmark workloads passed on the current runtime source. The separate editor-transaction/CPU diagnostic also passed.
- Changed benchmark code passes ESLint and patch whitespace checks. Application runtime/schema files are unchanged by this review.

Reproduce the deterministic numeric-layout audit with:

```sh
node --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs scripts/audit-publication-pagination-cache.mjs
```

## Next sequence

1. Coalesce synchronization of the inactive author editor and verify activation, selection/history and saved-document fidelity.
2. Reduce main-thread measurement/projection to affected ranges; retain the verified numeric paginator and fallback.
3. Repeat the same diagnostic, then measure representative note-heavy documents in production desktop and Android builds. Set separate preparation, input-latency and memory budgets using those results.
