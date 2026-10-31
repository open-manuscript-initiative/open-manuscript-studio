# Phase 7 stabilization: OMI-SPEC-240 and OMI-SPEC-230

**Specification baselines:** OMI-SPEC-240@0.1.0 and OMI-SPEC-230@0.1.0, both **Draft**. This is a requirement-mapped Studio implementation improvement, not a normative profile release, complete publication-system approval, independent conformance result or application version bump.

## Semantic rendering and publication problems addressed

| Requirement / purpose | Previously observed risk | Implementation evidence |
| --- | --- | --- |
| RPP-001, RPP-021, RPP-220/221; SPEC-230 single semantic source | Embedded `section.children` were ignored by publication section-tree building; HTML/JATS/PDF derived output could omit entire subsections | Derived preorder flattening without altering manuscript objects; nested section/child-block HTML/JATS fidelity test |
| RPP-004, RPP-100/101, RPP-220; profile validation | Only direct root-section blocks were checked for image alt text and table header requirements, allowing nested accessibility failures through publication readiness | `walkManuscriptStructure`-based deep checks with target-ID diagnostics |
| RPP-021/060; SPEC-230 reference portability | Reference resolution relied on shallow section/paragraph IDs, could accept a wrong target kind and reject a valid nested figure | Type-aware semantic target resolution based on `collectCrossReferenceTargets`, with a negative mismatch test |
| RPP-040, RPP-220; SPEC-230 self-contained outputs | Self-contained HTML only embedded image assets from root sections; deeper image URLs could remain package-local and produce broken publications | SHA-256-verified inline asset processing across all nested sections/blocks; positive and missing-byte tests |
| RPP-001, RPP-005; SPEC-230 reproducibility | Rendering changes must not mutate committed scholarly state | Original manuscript JSON equality before/after all tested rendering paths |

## Publication-output responsibilities retained

- Work from an authorized, audience-safe publication projection, not reviewer-private snapshots or hidden source-origin assertions.
- Do not fabricate editorial acceptance, review completion, copyright or publication authority when a renderer or profile succeeds.
- Published outputs must still pass their target-specific gates: JATS 1.4 DTD and semantic fidelity, PDF pinned renderer and PDF policy, semantic HTML validity, resource integrity and exact `.omi-build.json` build provenance.
- No automatic restructuring, renumbering persisted into the manuscript, change to author editing permissions, or replacement of scholarly citation targets.
- No publication style/schema version change or software version increment in this phase.

## Explicit gaps and release conditions

- OMI-SPEC-240 has no approved complete profile vocabulary/schema or independent conformance suite. Its requirement matrix remains partial.
- OMI-SPEC-230 is currently a conceptual Draft, not a complete interoperable publishing workflow standard. Review and editorial authority remain separate from rendering.
- Future independent tests must cover all supported nesting combinations, typed bookmark/link destinations (including JATS-specific anchor encodings), font substitution, unknown presentation extensions, target-specific note placement, accessible PDF tagging, multilingual glyphs, metadata deposit, and private data leakage.
- Browser / Android / desktop publication testing with long historical manuscripts and complex notes/tables is still required.
- Mandatory GitHub CI, CodeQL, publication release gates and manual approval must be green before this phase can be marked accepted. Earlier phases 5 and 6 must also finish review and merge; a green PR alone is not proof of sequence completion.
- **No Studio version increase until every one of the nine stabilization phases is accepted** and the user approves the unified app and website release.
