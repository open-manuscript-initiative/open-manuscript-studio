# ADR-032 — Editable publication renditions and source lineage

Date: 2026-11-04. Status: proposed documentation of the maintainer-confirmed direction; implementation gaps below remain open. Refines OMI architecture ADR-004/005/007/008/009/018/019/021.

## Decision

Typesetting belongs to publication preparation, not source processing. A publication rendition may own editable text stories, frame chains, page styles, graphic crops and generated pagination. A separate rendition is not itself architecture drift, even when stored in the same OMI container as its source. The canonical manuscript remains authoritative for the source manuscript; it is not required to be the only editable text in every downstream publication rendition.

| Object | Authority | Change behavior |
| --- | --- | --- |
| Source manuscript | Structured manuscript content and its revision history | Every part remains editable through the existing authorized workflow. |
| Publication rendition | The explicitly identified publication version's content and layout | Authors may edit every text and graphic object, add/remove/reorder content and change layout. Divergence is recorded, not prevented. |
| Exported artifact | The actual bytes produced from one rendition snapshot | A new export identifies its rendition and input lineage; hashes identify bytes, not review or signing authority. |

Keeping a manuscript revision immutable in history does not lock its working copy. No new editing permission, read-only mode or forced return to source processing follows from this decision. Existing collaborator/reviewer authorization remains in force.

## Required lineage and reconciliation contract

- Visible author credit may use the author's name and ORCID iD. It does not identify a particular document or revision and is not, by itself, evidence of review, approval or a document signature. The internal source/rendition identifiers, revision and digest need not be printed in the publication. ORCID display does not imply authenticated control of that iD; retain the existing verified identity/evidence distinction.
- Identify the source manuscript, immutable starting revision and its existing state digest. Identify the rendition and the rendition snapshot used for each build. A manuscript authored directly in publication preparation can explicitly have no imported source; missing lineage in a historical layout is **unknown**, not a fabricated relationship to the current head.
- Treat source updates and rendition edits separately. A changed source is a reconciliation opportunity, not permission to overwrite the rendition. Import, refresh or merge must be explicit, preserve the previous version and report conflicts and affected objects. Repeated import must not silently duplicate text. The author may retain, change or omit content deliberately.
- Reuse existing revision/build provenance mechanisms where applicable. Freeze any new mapping/profile and snapshot subject before implementation. A source fingerprint must not be computed recursively over the mutable rendition stored inside that source. Do not redefine the existing history state-digest algorithm or rewrite historical snapshots.
- Distinguish content changes, presentation-only changes and unresolved comparison. An unchanged source revision alone cannot establish that the rendition still contains the reviewed text. Reuse the existing server-authorized, exact-subject assurance contract; modified or unverified content cannot inherit a peer-reviewed seal merely through a source ID. Styling alone must not be equated with a changed scientific conclusion, but its exported artifact still needs the required subject binding. Unknown coverage is not verified coverage. No new review authority is granted to the local layout or its extension fields.
- Public delivery exports only the approved rendition, resources and permitted provenance. A publication workflow does not make source drafts, hidden history, reviewer identities, local paths or private metadata public. Do not automatically embed the full source container to prove lineage.

## Fidelity and loss reporting

The rendition's initial import must account for text, notes, citations, tables, figures, captions, annotations and relevant source attribution. Renderers declare what they preserve, transform, omit or cannot interpret. Intentional author edits/deletions are changes to a publication version, not automatically accidental loss. Unsupported semantics must be reported before a complete-manuscript export is claimed; do not solve a missing renderer by disabling author editing.

Layout can be saved, revised and recovered independently of source synchronization. Preserve historical manual layouts and unknown extension data through the existing compatibility policy. Stable support requires semantic and visual acceptance for the declared renderer/profile, not merely a well-formed frame extension or a working export button.

## Source audit at a3ac0e98194c7d39a0013e280453c7f428d86dd0

| Observed implementation | What it proves / remaining gap |
| --- | --- |
| `src/model/publicationFrames.ts`: `urn:omi:studio:publication-frames:1`, `stories[].text`, frames and styles; `publicationAutoFlow.ts`: automatic continuations | Valid editable publication state. It does not yet have an explicit source-revision binding, rendition identity or semantic change comparison. No schema change is introduced by this ADR. |
| `src/app/publicationFrameActions.ts`: `publication.frames.set` pending change and idle checkpoint | Existing document history captures the extension change. It does not establish which earlier source revision populated a story. Application-port extraction remains the existing B01/B03 work; separate rendition state is not itself a store-ownership violation. |
| `PublicationFrameEditor.tsx`: editable textarea and explicit text import using `storedContentText`, appended to the selected story | The author can edit independently. Import currently flattens source text and can append it again; no semantic mapping, conflict comparison or import-completeness receipt is established. |
| `publicationFrameRendering.ts`: positioned plain-text lines; graphic resource reuse; overflow/missing-graphic rejection | Local flow/graphics guards exist. Notes, inline markup and annotation mapping, source/rendition/build binding and full semantic fidelity are not proved by these guards. This export must not be advertised as a complete structured-manuscript conversion. |
| Existing `publication-frames.test.ts` and `publication-frame-pages.test.ts` | Synthetic flow, geometry, text preservation and extension round trips. They are not proof of full scholarly-content mapping, independent renderer conformance or source-lineage enforcement. |

The source inspection corrects the earlier diagnosis: the unresolved risks are unbound lineage, undisclosed conversion loss and incorrect assurance reuse, not the existence of a second editable publication version.

## Incremental implementation and acceptance

1. Under C03/C04, specify and characterize the versioned source-to-rendition mapping and immutable rendering context. Keep B05/B06's source ContentCodec work separate; do not remove rendition editing as a shortcut.
2. Implement lineage/change tracking and explicit refresh through the existing application session/history boundaries (B01/B03/B07). Do not silently migrate existing frame text into source blocks or discard it.
3. Under C03–C05, add rich-content mapping and per-renderer loss diagnostics. Cover a synthetic manuscript with footnotes, citations, table, figure/caption, inline formatting and annotations; compare import, edit, save/reopen, source change, reconciliation and actual export.
4. Under E03 and C15/ADR-021, verify unchanged-content versus changed-content assurance, missing/forged lineage, privacy, undo/recovery, repeat import and long-manuscript performance. Preserve E02–E05 and existing release gates. Record ordinary editing as usable while unproved completeness/assurance claims remain unavailable.

This PR is architecture documentation only. It does not implement lineage fields, change the schema/container version, migrate the database, freeze the portable AST, change review decisions or approve an RC. Revisit when the mapping/profile, refresh semantics or assurance subject changes.
