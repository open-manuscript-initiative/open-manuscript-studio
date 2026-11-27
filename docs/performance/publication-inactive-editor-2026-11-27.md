# Inactive author editor synchronization — 2026-11-27

Follow-up to [the initial publication performance review](publication-review-2026-11-27.md), implemented in PR #1098. The canonical OMI manuscript continues to update synchronously during publication editing; the inactive author view no longer rebuilds its document for every publication character.

The [front-matter follow-up](publication-front-matter-2026-11-27.md) addresses the large-document title latency observed here. The measurements below remain historical evidence of the inactive-editor change.

The later [note-line correction](publication-note-line-2026-11-27.md) fixes the separately recorded `note-5` failure. The measurements and original test statuses in this report remain historical evidence.

## Behavior and scope

- An editable publication canvas owns a runtime activity registration. Multiple registrations and repeated mount/cleanup are safe; no document lock or schema field is added.
- The author editor stays mounted and inert. Its serialized projection, external content updates, focus registration and proofing work are deferred while publication editing is active.
- Closing publication editing or entering the mobile preview releases the registration. The existing editor refreshes before paint, with selection remapped by stable block identity and bounded valid fallbacks for removed content. Formatting-only changes retain the selected text offsets.
- History boundaries separate the aggregate refresh from preceding and subsequent author edits. Editability changes suppress update emission so a stale inactive document cannot overwrite canonical content.
- Active external synchronization stays passive; resuming a view uses one layout-phase refresh. Unchanged proofing selections are not repeatedly published back to React; focus republishes selection ownership.
- Live Yjs editors deliberately retain the existing synchronization bridge and bypass deferred serialization/content updates. Concurrent live collaboration was not newly acceptance-tested by this browser fixture.

## Validation

The local targeted suites pass: 37 continuous-editor/selection tests, 70 publication/proofing/working-state tests, and six semantic import-boundary checks. TypeScript, changed-file ESLint and patch whitespace checks pass.

Eight of nine selected browser correctness cases pass on Chromium 158. The new cases verify no inactive document replacements while typing, one refresh on return with the same editor instance and selection, author and publication undo/redo, checkpoint/OMI export while still suspended, switching manuscripts, repeated open/close and mobile preview transitions. Existing HTML/print switching, reversible author/publication font overrides and facing-page paragraph/table/note editing also pass.

The existing note-heavy single-page audit fails at `note-5` on its initial placement check. The same failure occurs on unchanged main `0d789d69`; this is retained as an unresolved baseline layout issue, not a passing test. The assertion and ordinary CI gate are unchanged. GitHub's repository-pinned browser publication/selection and paragraph-style/hyphenation gates pass on runtime commit `bb96a80a`; the local alternative-executable failure does not establish its cause or replace those separate results.

## Measurement

Compared unchanged main `0d789d69` with runtime patch `bb96a80a` on the same shared Linux AMD EPYC 9V74 host, Node 24.22.3, Chromium executable 158.0.8127.0, 1440 × 900 viewport, one worker and no retries. Both used the same updated harness and dependency lockfile. Each workload typed 30 characters with a requested 20 ms delay. The baseline ran first, then the patch; each has one run per workload.

All six performance workloads pass on each revision, including the input/focus and React update-depth assertions. The baseline's separate note-placement test fails as recorded above; the full baseline browser command therefore exits unsuccessfully despite its six passing benchmark cases. [Raw samples, statuses and limitations](publication-inactive-editor-2026-11-27.json) preserve that distinction.

Times below are milliseconds. Median/p95 are keydown to the second animation frame, a paint proxy. Opening includes driver overhead and can overlap initial pagination.

| Workload | Before median / p95 | After median / p95 | Before / after open-to-caret |
| --- | ---: | ---: | ---: |
| 0 blocks, single, title | 28.0 / 61.5 | 26.6 / 67.5 | 284.7 / 319.4 |
| 100 blocks, single, body | 300.3 / 469.1 | 86.1 / 107.0 | 1924.7 / 2000.9 |
| 400 blocks, single, body | 509.6 / 776.4 | 168.1 / 224.4 | 9211.7 / 6596.8 |
| 400 blocks, facing, body | 553.3 / 797.8 | 173.0 / 234.1 | 9128.3 / 7316.6 |
| 1000 blocks, facing, body | 1144.5 / 1795.8 | 107.1 / 226.3 | 9833.6 / 12722.0 |
| 1000 blocks, facing, title | 890.7 / 1081.8 | 877.1 / 1095.4 | 16130.1 / 15770.8 |

Body input improves in these observations. The large-document title remains near 0.9 s median, and 1000-block opening takes longer in this run. This patch does not establish faster title editing or faster opening. Main-thread publication measurement/projection remains the next performance target.

Do not infer a monotonic size/latency relationship or a release speedup guarantee from the 30-sample, single-run results. Pagination cadence and preparation are not isolated steady-state workloads. Both inactive-view deferral and proofing-selection notification suppression are included; their individual timing contributions were not isolated. Synthetic paragraphs are not physical page counts. Production builds, Android/WebView, process memory/PSS, and representative note-heavy acceptance remain unmeasured.

Reproduce the functional checks and the opt-in diagnostic separately:

```sh
npx playwright test e2e/inactive-author-editor.spec.ts --project=desktop-chromium --workers=1 --retries=0
OMI_PUBLICATION_BENCHMARK=1 npx playwright test e2e/publication-performance.spec.ts --project=desktop-chromium --workers=1 --retries=0
```

The benchmark checks actual input focus, resulting text, sample count and React update-depth errors. It has no machine-dependent timing threshold. Use `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` only when an alternative executable is intentional, and record its actual version separately from the emulated user agent.
