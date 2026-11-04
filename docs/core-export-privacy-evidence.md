# Core export/privacy evidence — 2026-11-04

Twelve scenarios exercise real JSON/container serialization and public publication exporters against OMI-SPEC-000@0.2.0 and OMI-SPEC-140@0.2.0. They provide **partial** evidence for REQ-PRI-009 (operational credentials excluded), REQ-MET-013 (supported public metadata visibility policy), REQ-PRI-003 (publication does not modify the canonical source) and additional REQ-MET-018 preservation observations. Producer declarations and specification lifecycle states are unchanged.

## Corrected defects

- Custom HTML, PDF source and DOCX templates previously rendered hidden/editor-only/author-and-editor notes and their inline labels. They now use the same non-mutating public publication projection as the standard exporters.
- `.omi` container export previously checked only its current-state JSON; separately serialized history could retain operational credentials. The container now inspects the complete source graph, including old snapshots and event payloads, before asset reads or artifact construction. It refuses the export instead of rewriting signed/historical data.
- Credential checks now recognize the existing fields plus API keys, ID tokens, authorization headers and session cookies, with case-insensitive camelCase, underscore and hyphen spellings. Matching applies to complete structured field names; prose and unrelated fields such as `tokenCount`, `passwordPolicy` and `privateKeyAlgorithm` remain unchanged. Errors identify the field path and do not echo its value.

The OMI reference validator receives matching structured-field recognition in the accompanying specification-repository change.

## Tested boundaries

Standard HTML, JATS, DOCX, ODT, IDML, EPUB, LaTeX, MIF, SLA, XTG, PDF HTML source, standalone HTML and publisher HTML ZIP are inspected for private identity assertions, nonpublic notes and inline markers. Custom HTML/PDF-source/DOCX outputs also retain the public note and surrounding prose. Source identity metadata, notes, nested blocks and opaque scholarly fields remain unchanged.

An authoring `.omi.json` or `.omi` file remains a full authoring/preservation backup, including private notes and retained history. It is not a public audience projection. Such backups still reject operational credential fields. Public artifacts are derived from the filtered view.

This does not prove arbitrary secret detection in prose, encoded strings, images or binary attachments, all extension-specific audience policies, every export pipeline, server-rendered PDF bytes, native/browser acceptance or independent interoperability. Unsupported audience policies are not certified by these tests. Every requirement mapping remains partial and the normative outcome remains indeterminate.

## Reproduction

Run `npm run test:core-privacy`. On a committed checkout, `npm run evidence:core-privacy -- --report test-results/core-export-privacy.json` executes the same cases and records source commit, relevant file hashes, exact Draft targets and per-case mappings. The dedicated CI workflow uploads a fresh report; `npm test` includes the suite.
