# Stabilization phase 8 — OMI-SPEC-340 import and export

**Normative baseline:** OMI-SPEC-340@0.1.0 (**Draft**).
**Studio scope:** Exchange-report envelope preflight, candidate validation and
synthetic regression fixtures. This is partial implementation evidence,
not formal conformance, a complete conversion or semantic-fidelity guarantee.

## Gap-to-implementation map

| Draft requirement | Pre-existing risk | Phase 8 change / evidence |
| --- | --- | --- |
| REQ-IO-001, 002, 013, 023–025 | A nonempty `.omi.json` export could be reported as successful without being valid OMI JSON | Parse canonical OMI JSON using the existing version/schema/reference parser before marking output inspected. Invalid documents receive `INVALID_ARTIFACT_ENVELOPE`, not a completed report. |
| REQ-IO-002, 013, 023, 031 | A ZIP export was treated as present if its first bytes were only `PK`, even without central directory or end-of-central-directory record | Reject truncated packages, fake headers and broken ZIP directory envelopes; check a valid central directory and local file entry, without claiming complete ZIP parsing or per-entry CRC validation. |
| REQ-IO-002, 013, 016 | An arbitrary nonarticle text payload could masquerade as JATS export evidence | Require a recognisable XML/JATS `article` envelope. **Full JATS 1.4 DTD, schema, semantic-fidelity and JATS4R gates remain separate.** |
| REQ-IO-003, 017, 021, 023, 024 | DOCX/ODT input was accepted for parser execution based only on extension | Inspect physical package structure before invoking the parser, retaining the original `File` and reporting `INVALID_SOURCE_ENVELOPE` when invalid. Check actual read-byte limits as well as declared size. |
| REQ-IO-002, 017, 024, 025 | A parser could resolve without a valid candidate, resulting in unstructured crashes or an apparently prepared import | Fail with `INVALID_IMPORT_CANDIDATE` before permitting an import candidate to proceed. Ordinary parsing failures retain distinct `IMPORT_EXECUTION_FAILED` status. |
| REQ-IO-004, 005, 014, 015, 020, 029–030 | No complete feature inventory / independently reproducible round-trip comparator exists | Existing `INSPECTION_INCOMPLETE`, `completed-with-loss`, `lossless:false`, `roundTrip:not-assessed` and `validation:not-run` must remain, even for envelope-valid output. |

## Boundaries, preservation and privacy

- The Studio `html` export-session mapping produces a zipped semantic HTML
  package. It is **not** the standalone HTML galley used for publication transfer.
  Each is independently validated in its relevant export service.
- This phase does not change manuscript text, paragraph/section editing
  permissions, hidden provenance behavior, or automatic source attribution.
  Sources remain editable after conversion.
- `File` input is independently retained. A failed parser or malformed
  candidate does not authorize replacement of existing manuscript content.
- No untrusted remote assets are fetched, XML external entities executed or
  archive members extracted during this new preflight.
- Diagnostic records use stable codes; never echo raw imported manuscript
  contents, credentials or private reviewer comments into error messages.
- OMI-SPEC-320 and OMI-SPEC-330 controls continue to govern full portable
  file/container validity, identities, history, assets and checksums.

## Remaining approval requirements

- Independently inspect DOCX and ODT round-trip fixtures with notes, tables,
  nested sections, citations, tracked changes and multilingual characters.
- Exercise source-candidate review, cancellation, failure recovery and author
  editing in browser, Android and desktop for long manuscripts.
- Verify external converter interoperability and distinguish which profiles
  preserve source identities, comments, private assertions, binary assets,
  styles and legal provenance.
- Deliver versioned format/mapping schemas, a thorough semantic-loss report,
  formal loss classification, complete fixture corpus and independent OMI
  conformance suite before any stronger profile or status claim.
- Review phases 5–7 (PRs #791–#793) sequentially before signing off phase 8.
  Require full GitHub CI, CodeQL, iOS/desktop, import/export and readiness
  checks on the exact commit.
- **Hold all Studio application versions until all nine stabilization stages
  are accepted**, then review release numbers and documentation together.
