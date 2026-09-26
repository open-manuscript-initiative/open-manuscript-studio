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
