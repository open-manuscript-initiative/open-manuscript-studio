# Publication front-matter input — 2026-11-27

Follow-up to [inactive editor synchronization](publication-inactive-editor-2026-11-27.md). This change addresses repeated layout measurement while editing a title, subtitle, motto or abstract whose displayed dimensions stay unchanged. Canonical OMI updates and checkpoint/export behavior remain immediate.

The later [note-line correction](publication-note-line-2026-11-27.md) fixes the separately recorded `note-5` failure. The measurements and original test statuses in this report remain historical evidence.

## Cause and correction

React updates the default-value text node of a controlled textarea as its value changes. The publication MutationObserver treated those child-list changes as document layout edits and scheduled a complete body measurement pass even when the textarea occupied the same space. Its existing filter ignored only textarea style writes.

A separate instrumented 1000-block title diagnostic typed ten characters: `measureBlocksChunk` accounted for about 5707 ms of sampled native bounding-box self time, while ten textarea scroll-height reads took 4.5 ms in total. This is a diagnostic with instrumentation, not the latency benchmark; other native rendering/program time was also present.

The old natural-flow measurement mode also cleared the sheet translation of every top-level block for every measurement chunk. Those ancestor-dependent style changes invalidated the document during initial preparation, so input still overlapped expensive native layout even after redundant textarea invalidation was removed.

The final measurement path retains top-level sheet translations. Flow positions already use layout offsets, and line/anchor coordinates are relative to their translated block; dimensions and those relative coordinates are translation-invariant. Inline spacers and continuation shifts are still neutralized when present, and restored before yielding. When no inline projection exists, the measurement flag is not toggled at all.

The observer now ignores value-text and intermediate-style mutations inside front-matter textareas. The existing ResizeObserver additionally watches the front-matter header, so actual wrapping, growth, shrinkage and width changes still schedule pagination. Mutations elsewhere, notes, font changes and structural edits retain their existing invalidation paths. No input debounce, deferred saving, alternate text measurement or numeric pagination algorithm is introduced.

## Correctness

- Two new browser cases pass in single and facing layouts. Twelve same-line input characters across the four fields cause zero measured body bounding-box reads; the values survive OMI serialization, and body sections remain identical. A longer multilingual title and its later shrink both trigger measurement, move the following text and restore its original position.
- The initial single-layout investigation recorded 543 body bounding-box reads for those twelve characters, with twelve textarea child-list mutations and 24 style mutations. The initial facing case did not settle within its observation timeout; this failed investigation is preserved as such in the JSON evidence.
- An additional oracle comparison in the existing facing-page fixture checks block dimensions/layout offsets, text-line coordinates, table rows and note anchors with retained translations against the former cleared-translation measurement. All 9,734 compared values match within 0.05 CSS pixels; the observed maximum difference is approximately 0.000031 CSS pixels. Hidden and editor-control text is excluded, matching the measured flow rather than native control internals.
- 98 targeted publication/page-style/flow/spread/working-state tests, TypeScript, changed-file ESLint and whitespace checks pass.
- Six of seven selected publication/editor browser cases pass, including the two front-matter cases and existing HTML/print and facing-page editing coverage. The strengthened coordinate-oracle facing-page case also passes. The existing initial `note-5` placement audit still fails under local Chromium 158, as it did on the unchanged revisions in the earlier report. Its assertion and ordinary CI gate remain intact.
- The previous PR head `847e3d41` passed the full main CI and platform builds. Its ARM macOS DMG packaging failed once after successful compilation and passed a targeted job retry; no packaging policy or script was changed. Those results do not establish acceptance of this new runtime commit.

## Measurements

Compared baseline `847e3d41` with final runtime `23fcc738`, using the same shared Linux AMD EPYC 9V74 host, Node 24.22.3, actual Chromium 158.0.8127.0, 1440 × 900 viewport, Vite development server, one worker and no retries. The dependency lockfile and benchmark harness are unchanged. The fresh baseline title ran first, followed by all six patched workloads. Each types 30 characters with 20 ms requested inter-key delay.

All seven benchmark executions pass, including focus, input content, sample-count and React update-depth assertions. [Raw measurements and verification evidence](publication-front-matter-2026-11-27.json) preserve every sample and the separate known failing layout audit.

The paired comparison is only for the 1000-block title workload. Times are milliseconds; median/p95 are keydown to the second animation frame, a paint proxy. Opening includes driver overhead and can overlap preparation.

| Workload | Before median / p95 | After median / p95 | Before / after open-to-caret |
| --- | ---: | ---: | ---: |
| 1000-block facing title | 953.2 / 1108.5 | 94.6 / 181.1 | 14251.4 / 5684.1 |

The other five rows below have no fresh paired baseline in this follow-up. Earlier inactive-editor measurements remain in their original report.

| Patched workload | Median / p95 | Open-to-caret |
| --- | ---: | ---: |
| 0 blocks, single, title | 30.8 / 72.2 | 295.2 |
| 100 blocks, single, body | 80.6 / 102.9 | 1459.0 |
| 400 blocks, single, body | 163.5 / 249.0 | 2446.0 |
| 400 blocks, facing, body | 113.8 / 285.9 | 2220.6 |
| 1000 blocks, facing, body | 102.1 / 145.5 | 5766.3 |
| 1000 blocks, facing, title | 94.6 / 181.1 | 5684.1 |

The long-document title response improves substantially in this observation, including input while preparation may still be active. Open-to-caret is not the completion time of full pagination. These are single runs with 30 samples on a shared host and fixed version order, not a statistically reliable speedup or release acceptance guarantee. Synthetic paragraph counts are not page counts. Full layout after genuine geometry changes, production builds, representative note-heavy manuscripts, Android/WebView and process memory/PSS require further measurement.

Reproduce separately:

```sh
npx playwright test e2e/publication-front-matter-layout.spec.ts --project=desktop-chromium --workers=1 --retries=0
OMI_PUBLICATION_BENCHMARK=1 npx playwright test e2e/publication-performance.spec.ts --project=desktop-chromium --workers=1 --retries=0
```
