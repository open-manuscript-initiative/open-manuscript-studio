# ADR-035 — Portable text-box profile and reviewed research-diagram contribution

Companion: [OMI #205](https://github.com/open-manuscript-initiative/omi/pull/205).

Date: 2026-11-13. Status: proposed repair, pending companion OMI/Studio merge and CI.
Refines ADR-001/002/004/008/018/019/022/023. No new identity, review or publication authority.

## Context

Studio #904 introduced editable graphical text and modified its vendored Draft OMI
schema without a matching canonical OMI change. Stored text-box content used editor
JSON without a versioned content contract. #903 inserted module-generated diagrams
without carrying their research sources into the manuscript.

## Decision

The OMI repository owns the additive Draft 0.3 schema for `visual.textBox` and
`visual.textBoxes`, including optional `contentProfile` and namespaced `extensions`.
Studio vendors exact bytes from an immutable OMI commit and records SHA-256 hashes
for both schemas and the shared golden fixture. Local checks detect edits and stale
generated validators; the existing mandatory OMI-SPEC-320 job also checks byte parity
against that exact upstream commit. This is a Draft schema reconciliation, not a
stable-format release or an assertion of complete ContentCodec readiness.

New boxes and supported DOCX drawing imports write the separately versioned,
experimental `https://openmanuscript.org/profiles/text-box-content/0.1` profile.
`content` remains a JSON string, with format `omi-text-box-content`, version `0.1.0`,
paragraphs, semantic runs and bounded presentation values. Its vocabulary is
independent of Tiptap. Only the adapter maps editor nodes/marks to this profile.
Validation is generated from the canonical JSON Schema at build time, avoiding
runtime code generation in native CSP environments.

Unprofiled legacy text/editor JSON remains readable and is never rewritten merely
by opening or saving. The first supported edit writes the new profile. Unknown
profiles and additive fields remain byte-for-byte in `content` on save and in
history. The UI and HTML/JATS diagnostics flag an incomplete view. An explicit
confirmed edit creates a supported representation while retaining original content
and profile in `https://openmanuscript.org/extensions/text-box-source/1`. Unknown
objects do not lock the whole manuscript, its geometry, or other author editing.
Do not silently reinterpret a new version as 0.1 or claim arbitrary editor JSON is
losslessly convertible. DOCX/IDML/ODT/EPUB/JATS layout fallbacks remain explicit.

Research workspace data stays in its existing workspace owner; the manuscript
receives a reviewed SVG snapshot, not the graph database, raw GEDCOM, private notes
or an executable module. Show the exact snapshot and source suggestion, require
explicit approval, and invalidate approval when source/declaration changes. Reject
confirmation if the workspace/view or target document/section changed.

External source data requires an editable source label. Insert the image, visible
source paragraph, provisional bibliographic record and `prov:wasDerivedFrom`
`author-confirmed` relationship together through `stageInsertBlocks`, in one
reversible change. Suggestions come from displayed source fields or imported file
names, not verified evidence. Existing export diagnostics distinguish visible
source text from structured relations unsupported by a target format.

The author may instead declare own research data: omit the visible source and
bibliographic assertion, retain a semantic annotation (`targetText` =
`omi:research-origin`, body format `omi-research-origin`, version `0.1.0`, assertion
`author-declared:own-research-data`, optional supplied source text). Normal HTML/JATS
publication omits this internal annotation; OMI retains it. This is not the
external-object declaration that work was created outside OMI, and never grants
review, verification or identity authority. The declaration is per reviewed
snapshot and must not be inferred automatically from missing sources.

## Alternatives and consequences

Keeping a divergent schema or relabelling Tiptap JSON as canonical content would
preserve the defect. Flattening all text into pixels would remove editability.
Blocking all author editing for unknown data is rejected; preserving the original
and requesting an explicit supported edit gives a recoverable path. Implicit graph
publication or source inference would bypass the module contribution boundary.

Merge the canonical OMI change and Studio companion together. Older readers may
not understand profiled text: preserve the raw content, upgrade to a compatible
reader, and do not advertise backwards rendering compatibility. There is no
container-generation change, database migration or broader release-gate waiver.
The conformance job remains part of existing exact-candidate evidence, and local
checks do not replace native/browser/operator acceptance.

## Acceptance and revisit conditions

Require independent schema/codec golden parity, legacy and future-data retention,
explicit lossy-edit recovery, positioned Unicode DOCX labels, JSON/container reopen,
HTML/JATS loss diagnostics, reviewed module insertion and provenance lifecycle,
private own-work annotation filtering, core dependency checks and browser interaction.
Revisit for new text vocabulary, editor migration, new import/export targets,
canonical schema changes, graph/source synchronization or authority-bearing evidence.
