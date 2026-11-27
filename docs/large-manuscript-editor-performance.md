# Large manuscript editor performance plan

Date: 2026-09-26

## Scope

This plan targets editing performance after a large manuscript has already been
imported. DOCX parsing has a separate benchmark and is not the primary bottleneck
here. The reference workload is a manuscript of roughly 500 pages with thousands
of notes, images, generated lists/index entries, citations and cross-references.

The semantic OMI model remains authoritative. Performance work must not weaken
round-trip fidelity, review/proofing history, note/citation reconciliation, OJS/OMP
handoff, or publication output.

## Current hot paths

The current implementation has five distinct performance domains.

1. **Continuous Tiptap editing**
   - Tiptap serializes the current editor JSON on a document update.
   - The continuous document is projected back to OMI sections.
   - The Zustand manuscript state is replaced with the new immutable projection.
   - Before this phase, the resulting React render rebuilt and stringified the
     whole study again even when the store update was only the echo of the same
     local Tiptap transaction.
   - Active-block tracking also walked top-level siblings from the beginning of
     the ProseMirror document on transaction/selection activity.

2. **Semantic synchronization**
   - Notes, citations and cross-references have reconciliation layers.
   - Note/citation/cross-reference reconciliation is already gated by changed
     workspace-reference detection.
   - Cross-reference label synchronization can still traverse the manuscript
     whenever cross-references exist. It should preserve structural identity when
     no label actually changes so React can avoid downstream work.

3. **React/store invalidation**
   - Continuous edits replace manuscript sections frequently.
   - Components that subscribe to the complete manuscript object are invalidated
     even when they only need stable note/citation/proofing metadata.

4. **Browser layout and paint**
   - Large volumes already progressively mount study editors.
   - A single very large study is intentionally still one semantic editor so
     cross-section selection and structural editing remain continuous.
   - DOM/layout virtualization for this case needs browser-level measurement
     before changing the editing model.

5. **Live publication print layout**
   - Print mode performs page-flow, line and footnote measurements.
   - This is a separate layout workload from the normal authoring editor and
     should be profiled and optimized independently.

## Phase 1 — safe hot-path reductions

This PR performs only changes that preserve the current editor/document contract.

- Reuse the exact locally-emitted Tiptap JSON when the store contains the same
  projected section objects, avoiding an immediate full
  `buildContinuousManuscriptDocument` + `JSON.stringify` echo.
- Preserve section/block object identity during cross-reference synchronization
  when the derived label is already correct.
- Resolve the active top-level block from ProseMirror's existing resolved
  selection position instead of scanning all previous top-level siblings.
- Remove the duplicate active-block calculation caused by listening to both
  `selectionUpdate` and `transaction`.
- Narrow `BlockEditor` Zustand subscriptions so ordinary section replacement
  does not invalidate editor-adjacent UI that only depends on annotations,
  citations, cross-references, bibliography, locale or proofing metadata.
- Keep the existing large-volume progressive study mounting behavior.

These changes are deliberately structural-sharing and lookup optimizations; they
do not alter the OMI schema, persistence format, Tiptap–OMI boundary, editor
capabilities, or review/security authority.

## Measurement protocol

Use the existing private DOCX benchmark for import/model metrics:

```
npm run benchmark:docx -- --input /path/to/reference.docx --assert-roundtrip
```

For the visual editor, measure the same reference manuscript in a production
build on a fixed machine/browser and record:

- document-open to first editable caret,
- keypress to next painted frame (median and p95),
- number and duration of main-thread long tasks above 50 ms,
- heap/RSS after open and after five minutes of editing,
- mounted editor count and DOM element count,
- time for note/citation/cross-reference insertion,
- time to jump to a distant search result,
- print-layout entry and repagination time,
- scroll responsiveness through the middle and end of the manuscript.

Do not compare results across different hardware/browser versions as a release
gate. Keep one reference environment for trend measurements.

## Phase 2 — browser rendering diagnostics

After Phase 1 is merged, add an opt-in browser benchmark around the real Tiptap
view rather than relying only on server-side ProseMirror serialization.

The benchmark should generate or load a non-sensitive stress manuscript and
measure:

- initial Tiptap view construction,
- React commits caused by one local edit,
- ProseMirror transaction duration,
- OMI projection/staging duration,
- browser style/layout/paint cost,
- DOM node count by top-level section.

Only after those measurements should off-screen rendering be changed. Candidate
techniques include bounded use of `content-visibility`/containment or a
ProseMirror-compatible viewport decoration strategy. Any approach must retain
cross-section selection, search navigation, IME input, accessibility and native
mobile selection behavior.

## Phase 3 — incremental semantic projection

If OMI projection/staging remains a dominant cost, make projection transaction
aware:

- identify top-level blocks touched by a ProseMirror transaction,
- reproject only affected OMI blocks/sections for text-only edits,
- fall back to the current full projection for structural edits,
- retain full-document reconciliation for operations that can renumber or
  retarget semantic references.

This phase requires explicit equivalence tests against the full projection path
before it can become the default.

## Phase 4 — publication layout

Profile print layout separately. Potential work includes:

- dirty-range pagination instead of full repagination,
- caching stable line measurements,
- measuring only pages near a changed block where possible,
- invalidating footnote placement only from the first affected page onward.

HTML5 visual mode should remain the low-layout-cost publication view.

## Release gates

Every performance change must keep these gates green:

- semantic editor round-trip,
- progressive study mounting/navigation,
- notes/citations/cross-references,
- tracked changes and proofreading,
- large DOCX benchmark,
- mobile/desktop editor tests,
- publication visual editor tests,
- OJS/OMP integration and release-readiness gates.

For the reference large manuscript, accept an optimization only when it improves
a measured hotspot without a material regression in memory, correctness or
interaction behavior elsewhere.

## Phase 3a — memory-backed editor snapshots (2026-11-25)

- Reuse immutable ProseMirror top-level node JSON and serialization through weak-key caches. A text edit does not reserialize every unchanged paragraph; both authoring and publication use the cached structured snapshot directly rather than reparsing the complete JSON string.
- Reuse projected block and section objects when their semantic content, metadata and ordering remain unchanged; cache structured-text note-anchor lookups without retaining closed documents or returning mutable cached data.
- Avoid reconstructing proofing decorations on unchanged selection transactions, skip full text scans when no review/correction/flow marks apply, and reuse the last snapshot fingerprint.
- Keep the synchronous canonical model update, reference reconciliation, and checkpoint semantics. The editor still builds a full ordered snapshot and scans structural boundaries; this is not full pagination virtualization.
- Regression coverage: 2,000 top-level paragraphs, exact native serialization, 1,999 unchanged cached nodes after a one-paragraph edit, equivalent full projection, undo, reorder and note anchor invalidation. This deterministic count is not a browser latency measurement. Measure key-to-paint, p95 and heap in the reference environment before claiming a speedup.

## Phase 3b — adaptive derived-cache budget (2026-11-25)

The node JSON, serialized text projections and note-anchor caches share one estimated
LRU budget per WebView. Weak keys prevent retention of closed documents; LRU accounting
is conservative (uncollected tickets can overstate live data). The budget is a
heuristic, not a measured JS heap or OS allocation. Full-document serialization,
canonical state, undo, DOM, images and renderer processes are outside this budget.

Maximum budgets by RAM tier (performance mode): 16, 32, 64, 128, 256, 512 MiB at
approximately 2, 3, 4, 6, 8, 12+ GiB. Balanced uses half; economy uses a quarter.
Unknown device capacity: max 32 MiB mobile / 64 MiB desktop. Background visibility
clears the derived cache and disables admission until foreground. Android polls
system MemAvailable in foreground every 30 seconds, limiting the budget to 1/16 of
available RAM and disabling it below 256 MiB. If native access is unavailable, the
browser hint or conservative fallback is used. No largeHeap permission is requested.

Before declaring Android minimum/ recommended RAM (provisional 3/6 GiB), measure
50, 100, 250, 500 and 1000-page reference documents in release builds, on devices
of multiple RAM tiers. Record adb dumpsys meminfo and Perfetto memory traces for
the app and associated WebView renderer processes, foreground/background/return,
p95 key-to-paint, peak PSS and OOM/renderer restarts, and compare cached/uncached
editing fidelity. The JS accounting is not PSS, and these measurements are not
yet available. No final store memory requirement is claimed.


## Phase 4a — repeatable publication input benchmark

Run the opt-in browser harness on the same machine, browser build, viewport and
power settings before and after merging publication optimizations:

```sh
OMI_PUBLICATION_BENCHMARK=1 npx playwright test e2e/publication-performance.spec.ts --project=desktop-chromium --workers=1 --retries=0
```

The fixture is synthetic and contains no private manuscript data. It exercises
a title-only manuscript and 100, 400 and 1,000 body blocks, including both
single-page and facing-page rendering for the 400-block case, plus title editing
while a 1,000-block facing-page document is open. These are block
counts, not page counts. Each run types 30 characters at a 20 ms requested
inter-key delay and checks that the text is present.

The body target is a paragraph inside a contenteditable editor. After clicking
it, send End through the keyboard rather than refocusing that non-focusable
paragraph with `locator.press`. Assert the editable host remains focused before
collecting samples. Otherwise the browser can send the entire input sequence to
the page body, yielding zero valid latency samples. The large-document title
case is necessary to exercise front-matter structural sharing; an empty title-only
document cannot establish its benefit for a long manuscript.

The Playwright report attaches JSON with open-to-caret time (including driver
overhead), median/p95/maximum keydown-to-second-animation-frame latency (a
paint proxy, not hardware/display timing), observed long tasks, DOM node count
and optional Chromium JS heap estimate. The heap estimate is not native RSS or
Android PSS. No absolute timing threshold is imposed on shared CI machines.

The harness uses source-module fixtures and the development server; it is a
repeatable comparative diagnostic, not release-build evidence. Repeat on
production WebView builds with device-side tracing and the representative
publication workloads before setting release latency or memory budgets.

The [2026-11-27 review](performance/publication-review-2026-11-27.md) records the
repaired benchmark, one-run before/after measurements and the remaining inactive
editor and main-thread DOM work. Its results are diagnostic evidence, not a
production or Android acceptance claim.

## Phase 4b — defer inactive author view synchronization

An editable publication canvas registers its lifetime with a reference-counted
runtime activity store. The mounted author view becomes inert and skips document
serialization, external `setContent`, focus registration and proofing work while
that canvas is active. Closing it or switching to mobile preview releases the
registration. The canonical OMI model and saving still update with every active
publication edit.

On return, the existing author editor synchronizes once before paint. Its text or
node selection follows stable block identities through document changes; missing
destinations use a bounded valid selection. History boundaries separate the
aggregate external refresh from edits before and after it. Editability changes
must not emit stale content. Active-view synchronization stays passive, and
unchanged proofing selections do not repeatedly invalidate the publication UI.
Live Yjs editors retain their synchronization bridge and deliberately bypass
deferred serialization/synchronization.

The [implementation evidence](performance/publication-inactive-editor-2026-11-27.md)
records lifecycle, save, selection and undo coverage plus comparative synthetic
performance workloads. Main-thread publication layout remains a separate target.

## Phase 4c — invalidate front matter by geometry

Controlled textarea value changes also mutate their default-value text nodes.
Treating those mutations as layout edits caused complete body measurements even
when the title or other front-matter field stayed on the same line. Ignore
mutations inside those controls and observe the front-matter header dimensions
instead. Real wrapping/growth/shrinkage continues to repaginate; canonical input
and saving stay synchronous. Keep top-level sheet translations during measurement:
layout offsets and block-relative line/anchor geometry are invariant under those
translations. Neutralize only existing inline spacers/continuations, avoiding a
whole-document style invalidation for every measurement chunk.

[Evidence and regression coverage](performance/publication-front-matter-2026-11-27.md)
include both page arrangements, all four fields, OMI serialization, body fidelity,
and title growth/shrinkage, plus a fresh long-document title comparison. Full
body measurement after a real geometry change remains a further target.

## Phase 4d — superscript note line ownership

A raised marker's upper edge can overlap the preceding measured text line. Use
its lower edge to associate the footnote with its owning line before pagination.
This preserves the existing distance fallback and reuses the bounding rectangle
already collected. [Evidence](performance/publication-note-line-2026-11-27.md)
records the formerly failing note/page boundary and passing default/raised-marker,
zoom, formatting, continuation, table, page-style and HTML regression checks.
