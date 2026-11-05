# Semantic relationships and fallback disclosure evidence — 2026-11-05

Twelve scenarios target OMI-SPEC-000@0.2.0, OMI-SPEC-100@0.2.0 and OMI-SPEC-120@0.3.0. They partially evidence REQ-PRI-005, REQ-OBJ-007 and REQ-DOC-015, and extend REQ-PRI-008. Models remain Draft and no mapping claims full conformance.

The portable JSON exchange retains explicit note, citation, cross-reference and source-attribution relationships and their target roles. Plain superscripts and nearby source titles do not invent those relationships. Generated JATS xrefs resolve to distinct note/reference targets and tables remain structured; HTML carries note/bibliographic links and tables. DOCX emits native footnote/endnote references and bodies. IDML retains the tested anchored native footnote but discloses the ordinary-text endnote fallback.

The tests exposed missing loss disclosures. DOCX/IDML now disclose unsupported structured source predicates, citations and cross-references. XTG, MIF, SLA and LaTeX additionally disclose ordinary note-list and descriptive visual-object projections. EPUB discloses omitted public note bodies and flattened visual objects. The portable source is unchanged. Existing HTML/JATS/ODT source-predicate diagnostics remain exercised. These bounded observations do not establish preservation of every semantic role in any adapter.

The new structured `semanticLosses` diagnostics also become adapter warnings in the existing exchange receipt. A non-equivalent fallback leaves the receipt incomplete and non-lossless; warning messages do not copy private note bodies. ExportFormatsPanel already forwards these adapter diagnostics. This change reports current limitations; it does not implement complete EPUB notes, native notes in text-oriented formats, or complete semantic roundtrips.

Run `npm run test:core-relationships`. From a committed checkout, `npm run evidence:core-relationships -- --report test-results/core-relationships.json` runs the same cases and records the exact commit, source hashes, Draft targets, environment and partial mappings. CI uploads this evidence and the regular core test chain includes the suite.

External-editor rendering/roundtrip, all malformed/orphan relationships, every nested object role, browser/native acceptance and independent interoperability remain open. The fixtures are synthetic and do not establish authorship, legal rights or editorial approval. Producer declarations and specification lifecycle states are unchanged.
