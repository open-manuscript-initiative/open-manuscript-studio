# Typeset in Studio and transfer HTML/PDF to OJS

Status: proposed implementation, 2026-11-18. Source/CI and real OJS deployment acceptance are separate.

## Editor workflow

1. In OJS, move the existing article to **Production**. Use an OJS connection and a personal editorial API key for that installation in Studio. The editor needs native production-stage access.
2. Open the study in Studio → **Live publication editor**. Apply/edit the publisher style, paragraph styles, page size, margins, running headers and print corrections. All manuscript content remains editable.
3. Choose **Publish the typeset study to OJS** on the editor toolbar. Select the journal connection and submission ID, then **Inspect OJS Production**. Published versions and submissions in earlier stages are rejected by OJS.
4. Select HTML, PDF, or both. PDF can be print or interactive. HTML uses the responsive semantic layout; PDF uses the print layout and Studio's configured built-in PDF service. The HTML reader plugin must be enabled in OJS to offer HTML.
5. Choose **Prepare selected outputs**. All selected files are generated from one committed manuscript and one snapshot of the current live publisher style/identity. Review the isolated HTML preview and generated PDF. Preparing does not write anything to OJS.
6. Confirm the exact destination/files, then choose **Transfer selected outputs to OJS**. Each file receives a separate verified native OJS galley/file receipt. The article is not published by this action.
7. Review the files and make the final publication decision in OJS. No external desktop typesetting program is required for this continuous HTML/print workflow.

Any change to manuscript content, publisher style/identity or selected Studio server invalidates the prepared transfer. Local editing remains available; prepare again. Native OJS metadata/stage changes are checked using the inspected workflow token and native locks, returning 409 rather than overwriting changed targets.

## Partial results and retries

The HTML/PDF group is not a cross-system transaction. If HTML succeeds and PDF fails or loses its response, HTML remains in OJS and its receipt remains visible. No automatic retry, removal or publication is performed. Inspect the OJS destination, select only the remaining output, prepare it and confirm a new transfer. Identical bytes/builds retain the plugin's existing idempotency behavior. Do not interpret an unknown response as proof that OJS stored nothing.

## Output and scope

The live continuous manuscript editor and its existing semantic HTML/print renderers are used. The independent frame-story designer is not silently substituted for the source manuscript and no new frame-to-scholarly-content mapping is claimed. Fonts must be available on the configured PDF renderer for intended typography; release acceptance must check actual rendered pages. HTML embeds raster images; PDF also retains registered SVG image support through the existing isolated offline renderer. Referenced image bytes are embedded only after size/SHA-256 checks. Missing, changed or remote image dependencies fail before transfer. Public projections retain the existing private-note/identity filtering.

The existing `omi-publication-artifact/1` and `omi-publication-build/0.1.0` contracts are reused. A new endpoint, plugin protocol, database migration, scientific-review authority or OMP feature is not introduced. Workflow-token support requires OJS Integration 1.7 or newer; use the current complete 1.8.3 package or newer. Native plugin checks still enforce stage, current unpublished publication, role, genre/locale, build identity and exact bytes.

[ADR-038](architecture/adr-038-live-publication-ojs-handoff.md) records the input/provenance and acceptance decisions.
