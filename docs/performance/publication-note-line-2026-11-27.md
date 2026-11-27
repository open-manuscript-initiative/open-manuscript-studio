# Superscript note line ownership — 2026-11-27

This fixes the `note-5` placement discrepancy recorded in the preceding publication performance reviews. Baseline main is `596f5259`; the runtime correction is `36e5d616`. The existing 18-note browser audit failed before the correction and passes afterward on the same Chromium 158 executable.

## Observed cause

The marker was assigned to a measured line using the top of its bounding rectangle. A superscript can extend above its own line into the preceding line's glyph box. In the recorded boundary case, the previous line contains the marker's top, even though the marker belongs to the next line:

| Measured value | Block-relative CSS pixels |
| --- | ---: |
| Previous line range (text offset 487) | 131.375–150.375 |
| Owning line range (text offset 549) | 150.703125–169.703125 |
| Marker top | 150.046875 |
| Marker bottom | 162.140625 |

The old distance calculation chose offset 487. The marker appeared on page index 2 while its note body was assigned to page index 1. After the fix, the same marker rectangle remains on page index 2 and the note body is also assigned to index 2. Page indexes in this report are zero-based.

## Correction

Assign the marker to the measured line containing its lower edge, using the existing nearest-line policy for positions outside measured ranges. Apply the existing block-relative and flow-spacer coordinate corrections before selection. The lower edge also works with table-row measurement units.

The implementation reuses the marker bounding rectangle already read by the measurement pass; it adds no DOM geometry reads. It changes live-editor line ownership for pagination, with no changes to note content, labels or ordering.

## Verification

- 117 targeted unit tests pass, including four new cases based on the recorded fractional geometry, zoom/translation invariance, table-row ownership and empty/out-of-range fallback behavior. The new file is included in the ordinary test script.
- TypeScript, changed-file ESLint and patch whitespace checks pass.
- Seven selected browser cases pass with one worker and no retries: publication opening, HTML/print editing, the original 18-note audit, a second audit with markers raised by another 2 CSS pixels, individual page masters/running headers, facing-page paragraph/table/note editing and newly inserted paragraphs.
- Both full note audits retain all original assertions: every note is below its marker on the same page; body text clears note areas; formatting-only changes, 50/100/75/100 percent zoom, body insertion, long-note continuation and HTML output preserve the expected behavior. The original assertion and tolerances were not relaxed.
- A separate initial-geometry diagnostic checks all 18 markers before and after: the baseline mismatch list is `note-5`; the patched mismatch list is empty.

[Raw geometry and test evidence](publication-note-line-2026-11-27.json) include all marker/page coordinates and the baseline measured-line snapshot. The investigation used synthetic text on a Linux Vite development server, Node 24.22.3 and Chromium 158.0.8127.0 at 1440 × 900. Temporary baseline instrumentation was removed from application source. These checks are live-editor regression evidence, not a new production or Android acceptance run.

Reproduce:

```sh
node --test --experimental-strip-types --import ./tests/register-ts-extension-loader.mjs tests/publication-note-line.test.ts
npx playwright test e2e/publication-editor.spec.ts e2e/publication-spreads.spec.ts e2e/publication-page-styles.spec.ts --project=desktop-chromium --workers=1 --retries=0
```
