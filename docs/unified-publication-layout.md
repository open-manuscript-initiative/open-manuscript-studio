# Unified publication layout: default text frame and automatic pages

## Implemented in this change

The frame-layout editor now starts with an A4 portrait page (210 × 297 mm), a 25 mm margin on each side and a single editable 160 × 247 mm text frame. Its primary story has an `autoFlowStoryId`. Overflow is measured using the existing typography-aware frame-flow engine. When the primary story grows, additional pages and linked continuation frames are created automatically. When it shrinks, empty *generated* pages and frames are removed, without deleting user-created pages or frames. The editable first-frame geometry, style and rotation are repeated on continuation pages. The existing 100-page frame-layout limit remains in force; unplaceable text is still reported as overflow instead of silently dropped.

This is an incremental step toward a unified text and frame layout, **not yet a replacement for the canonical rich-text publication editor**. The existing frame stories still contain plain text, while the continuous editor remains authoritative for structured blocks, notes, inline formatting, annotations and page-sensitive typesetting. The frame view must not be used as the sole export path for manuscripts requiring those semantics.

## Required follow-up for full unification

1. Make the canonical manuscript block tree the sole source of editable text; remove text duplication between continuous-layout blocks and frame stories.
2. Use a common pagination engine for rich text, tables, figures, footnotes and manually positioned frames. Generated continuation pages must remain virtual or independently reproducible from saved page/frame templates so very long manuscripts do not trigger whole-document updates on each keystroke.
3. Have page styles and default text-frame geometry define the continuous editor's available page area, including alternating layouts and mixed-size pages. Allow custom frame chains without losing the default automatic continuation.
4. Render frame positioning, clipping and page geometry consistently in the live canvas, HTML, PDF, DOCX and IDML; preserve the semantic manuscript and the notes in every export format.
5. Provide one publication editing UI with independently editable frame objects, without switching to a lossy plain-text editor. Add round-trip and long-manuscript performance tests.

The first migration must keep existing manual frame documents usable. Existing layouts without `autoFlowStoryId` keep their manual-linking behavior unchanged.

## One publication workspace (UI consolidation)

The two mutually exclusive *Continuous layout* / *Frame layout* buttons have been removed from the live publication editor. The canonical rich-text print/HTML5 canvas stays mounted and visible; `Frames and page styles` opens a closeable inspector over the same workspace on desktop and mobile. It retains access to historical manual frame chains and automatic A4 frame continuations.

**Semantic boundary remains:** This is not yet a single typesetting engine. Frame stories are stored as plain text separately from the authoritative structured manuscript. The frame inspector explicitly warns not to use frame-only HTML/PDF as the complete manuscript export when inline formatting, tables and notes are present. The main canvas and its export pipeline remain the authoritative document preview.

The remaining architectural tasks listed above must be completed before declaring full underlying unification. The single UI deliberately avoids describing continuous text and frames as competing editing modes.
