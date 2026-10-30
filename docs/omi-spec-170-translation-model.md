# OMI-SPEC-170: Studio translation implementation profile

Profile: **studio-translation-0.1**, extension namespace: **urn:omi:studio:translation:1**.
Status: **experimental implementation proposal**, 2026-10-30.

The upstream specification registry currently reserves OMI-SPEC-170 (Translation Model).
There is no published normative 170 document or version to claim conformance against.
This document defines Studio's executable profile and its limitations. It does not
change the canonical OMI-SPEC-320@0.3.0 schema or declare an invented 170 version in
`omi.specifications`. Adoption by a future canonical 170 model will require an explicit
profile migration, with a separate interoperability review.

## Author workflow

Open **Manuscript menu → Translations**. Choose a concrete BCP 47 target language
and either the whole manuscript or selected section. Arbitrary valid tags, including
regional and script variants, are accepted independently of interface language settings.
Each variant stores its own source language, source manuscript ID, source checkpoint,
scope, aligned source snapshots and target text. Multiple target languages and multiple
variants of one language are allowed.

Edit target text and translator notes, select **Equivalent translation** or **Intentional
adaptation**, then save. **Mark as reviewed** is a separate explicit decision. Target
text and equivalence edits invalidate that decision. A machine result is always a draft.
Account-linked scholarly agents are recorded for origin, editing and review when the
account has a matching agent ID in the manuscript. Unlinked accounts stay unattributed;
the implementation does not invent a scholarly identity from an account name.

Source editing remains unrestricted. Source changes never rewrite target text. The panel
calculates freshness from the current source, rather than persisting an easily outdated
`isStale` flag. **Update source alignment** explicitly accepts the new source baseline,
keeps target text and notes, and resets affected alignments to unassessed drafts.
New supported source segments get blank draft alignments. Missing objects remain in the
ledger until the author explicitly archives their alignments; the archived translations
stay in the manuscript. A restored source gets a fresh alignment ID after archival.
Source language changes require a new translation relationship.

DeepL's **Save as language variant** now writes into the same portable manuscript
model after the author has seen the preview. The request's exact source snapshot,
scope and target language are retained even if form controls or source content change
while the request is running. A preview cannot write into a different active document.
No second server-side variant write is needed. Previously saved server records remain
accessible as **Earlier server variants**; their missing alignment/version evidence is
not silently invented or labelled reviewed.

The panel renders 20 alignment editors per page. Saving a translation action checkpoints
the shared working state. Source text is never locked by translation state. Revision
reversion, OMI JSON serialization and the state digest include the extension.

The `translationModel` interface catalog is complete in the nine primary locales.
Other interface locales use the existing English fallback for this experimental
workflow, as they do for research-module and supplemental UI catalogs. JSON parity
and PO audits require all translation-workflow entries in every primary locale.

## Portable representation

`extensions["urn:omi:studio:translation:1"]` contains:

| Object | Fields and meaning |
| --- | --- |
| Model | `profile`, `variants[]`; unknown extension members are retained |
| Variant | Unique `id`, `sourceManuscriptId`, `sourceRevisionId`, canonical `sourceLanguage` and `targetLanguage`, `scope`, creation/modification timestamps |
| Scope | `kind`: `manuscript`, `section`, or `block`; source object `id` |
| Collections | Active `alignments[]`, retained `archivedAlignments[]` |
| Alignment | Unique `id`, `sourceAnchor`, `sourceObjectId`, `sourceText`, `sourceFingerprint`, editable `targetText`, `notes` |
| Workflow | `status`: `draft` or `reviewed`; `equivalence`: `unassessed`, `equivalent`, or `adapted` |
| Provenance | Immutable generation `origin` with `method`: `human` or `machine`, timestamp, optional agent; machine origins require a provider name |
| Editing/review | Modification time, optional `lastEditorAgentId`, `reviewedByAgentId` and `reviewedAt` |

Alignment IDs belong to this extension ledger. They are not replacements for canonical
section, block, annotation or anchor identifiers. `sourceAnchor` is an explicit field or
Tiptap text-node path produced by the existing structured translation planner. The
source fingerprint is SHA-256 over deterministic key-sorted JSON of the addressed source
context. Text and visual blocks include their whole object, so path shifts, repeated text,
mark changes and inline scholarly-object changes conservatively require review.
An asset-backed image's temporary preview URL is excluded; its stable asset ID remains
included, so reopening an OMI container does not invalidate an unchanged image caption.
Section title anchors fingerprint the title; front fields fingerprint their value;
keyword indices fingerprint the keyword array to detect reordering.

Freshness is `current`, `stale`, or `missing`. Source language, object identity, anchor,
source text and fingerprint must all match for `current`. Unrelated manuscript revisions
alone do not invalidate translations. The source revision records the checkpoint used
for creation or explicit rebaselining; per-alignment fingerprints additionally cover
working edits when a saved provider preview is accepted later. It is not a global
"all segments were translated from this single revision" claim after partial rebasing.

The profile validator checks types, distinct concrete language tags, unique IDs and active
source anchors, SHA-256 shape, timestamps, source manuscript identity, provider provenance
and internally valid review states. It validates recognized profile data in the live
state and historical snapshots on portable import/export. Unknown future profile values
are retained as opaque extension data; the panel refuses to edit them. Other extension
namespaces remain untouched.

## Export and completion

Both **Parallel text HTML** and **Target text HTML** require all active supported source
segments to have current, nonempty, explicitly assessed and reviewed translations. New
or missing segments block release until synchronized or explicitly archived as applicable.
The aligned proof follows current source order and emits escaped plain text, BCP 47 `lang`
attributes, `dir="auto"`, UTF-8 metadata and source/variant identity. Translator notes and
account information are not published. The exported proof does not execute source markup.

These exports are aligned **text proofs**, not new canonical manuscripts or fully styled
scholarly publications. They do not change source manuscript identity, mint publication
identifiers, copy untranslated source content into a supposedly translated manuscript,
or claim that separate language editions have been published.

## Supported surfaces and open work

Supported: manuscript title/subtitle/abstract/keywords; section titles; plain and Tiptap
text; annotation bodies; image alt text; image/table/chart/equation captions and chart
titles. Embedded nested sections and child blocks are traversed. Block-level scope is
available through the model API; the panel offers manuscript and section scopes.

Bibliography, citation labels, note markers, cross-reference nodes, code, equations,
music data, table cells and chart data are deliberately not sent as translation text.
The source remains fully editable. This is partial coverage of scholarly-object surfaces;
the completion indicator applies to supported text units in the selected scope.

Open work for canonical 170: independent language-manuscript identity and version graphs;
many-to-many/split/merge alignments; text-range anchors independent of editor JSON paths;
cross-document synchronization; mixed source languages; complete structured target editing;
translation-aware DOCX/PDF/JATS publication and actual parallel publication editions;
assignment/permission enforcement through a normative collaboration profile. No automatic
translation calls, external content submission or authoring restrictions are introduced.

## Executable requirement mapping

These are **local profile requirements**, not normative upstream REQ identifiers.

| Requirement | Implementation evidence |
| --- | --- |
| TR-01: source/target languages and distinct variants | `createManuscriptTranslation`; language and partial-scope tests |
| TR-02: stable ledger IDs and explicit object/path mapping | `collectTranslationUnits`; nested/repeated-text tests |
| TR-03: draft, assessed equivalence/adaptation, explicit review | `editTranslationAlignment`; empty/target-edit review tests |
| TR-04: version-aware source freshness without content locking | `translationFreshness`; source-change tests |
| TR-05: explicit synchronization preserves translator work | `synchronizeTranslation`; synchronization tests |
| TR-06: new/deleted/restored objects preserve evidence | `translationProgress`, `archiveMissingTranslation`; lifecycle tests |
| TR-07: human/machine provenance and optional scholarly agent | origin/edit/review fields; machine-validation tests |
| TR-08: portable preservation and shared immutable history | `translationActions`, portable validators; action/roundtrip/reversion tests |
| TR-09: safe parallel and target text proofs with release gates | `renderTranslationHtml`; HTML escaping/release tests |
| TR-10: reviewed provider preview uses captured request basis | `IntegrationExecutionWorkspace`, active-document guard test |
| TR-11: responsive author interface and pagination | `TranslationPanel`; desktop/mobile-width Playwright scenarios |
| TR-12: canonical PO source and locale parity | Nine primary PO catalogs and generated runtime catalogs |

Run `npm run test:translation-model`, `npm run build`, and
`npx playwright test e2e/translation-model.spec.ts --project=desktop-chromium`.
