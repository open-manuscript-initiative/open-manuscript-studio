# Unified publication layout: default text frame and automatic pages

## Publication-stage authority — 4 November 2026

Typesetting prepares an editable publication rendition; it is not source processing. Separate frame text and layout are legitimate publication state. The source manuscript remains authoritative for its own content/history, while the rendition may diverge deliberately. Authors may edit every part of either working version through existing permissions. See [ADR-032: publication rendition and source lineage](architecture/adr-032-publication-rendition-boundary.md) for the decision, inspected implementation, open gaps and acceptance work.

The current frame profile does not yet bind a rendition to its starting source revision or provide complete rich-content mapping. Plain-text import and frame-only exports must not be treated as lossless scholarly-manuscript conversion. These limitations call for lineage, diagnostics and renderer work, not a ban on independent publication editing.

## Implemented in this change

The frame-layout editor now starts with an A4 portrait page (210 × 297 mm), a 25 mm margin on each side and a single editable 160 × 247 mm text frame. Its primary story has an `autoFlowStoryId`. Overflow is measured using the existing typography-aware frame-flow engine. When the primary story grows, additional pages and linked continuation frames are created automatically. When it shrinks, empty *generated* pages and frames are removed, without deleting user-created pages or frames. The editable first-frame geometry, style and rotation are repeated on continuation pages. The existing 100-page frame-layout limit remains in force; unplaceable text is still reported as overflow instead of silently dropped.

This is an incremental step toward unified publication tools, **not yet a replacement for the rich-content export pipeline**. Frame stories currently contain plain text; structured blocks, notes, inline formatting and annotations still require the existing rich-content path. A separate publication rendition is allowed, but the current frame export does not prove complete preservation of these semantics.

## Required follow-up for full unification

1. Identify the source revision and the separately editable publication rendition; define explicit semantic import, change comparison and refresh without overwriting author edits. Retain the source manuscript as its own authority rather than forcing both working versions to share all text.
2. Use a common pagination engine for rich text, tables, figures, footnotes and manually positioned frames. Generated continuation pages must remain virtual or independently reproducible from saved page/frame templates so very long manuscripts do not trigger whole-document updates on each keystroke.
3. Have page styles and default text-frame geometry define the continuous editor's available page area, including alternating layouts and mixed-size pages. Allow custom frame chains without losing the default automatic continuation.
4. Render frame positioning, clipping and page geometry consistently in the live canvas, HTML, PDF, DOCX and IDML; preserve the semantic manuscript and the notes in every export format.
5. Provide one publication workspace with independently editable text and graphic objects, visible lineage/change state and explicit conversion losses. Add source/rendition, save/reopen, renderer and long-manuscript performance tests.

The first migration must keep existing manual frame documents usable. Existing layouts without `autoFlowStoryId` keep their manual-linking behavior unchanged.

## One publication workspace (UI consolidation)

The two mutually exclusive *Continuous layout* / *Frame layout* buttons have been removed from the live publication editor. The canonical rich-text print/HTML5 canvas stays mounted and visible; `Frames and page styles` opens a closeable inspector over the same workspace on desktop and mobile. It retains access to historical manual frame chains and automatic A4 frame continuations.

**Semantic boundary remains:** This is not yet a single typesetting engine. Frame stories are stored as editable publication text separately from the structured source manuscript. The frame inspector explicitly warns not to use frame-only HTML/PDF as the complete manuscript export when inline formatting, tables and notes are present. The main canvas and rich-content export pipeline remain available; source-to-rendition lineage and full semantic mapping are outstanding work.

The remaining architectural tasks listed above must be completed before declaring full underlying unification. The single UI deliberately avoids describing continuous text and frames as competing editing modes.
