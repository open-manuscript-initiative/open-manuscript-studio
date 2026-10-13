# ODT import/export: Preview contract

ODT is a Preview interoperability format, not a lossless OMI working format or a stable 1.0 fidelity promise. Keep OMI JSON/container as the authoritative source graph/history artifact. ODT authoring uses the existing explicit source/own-work import confirmation and native/browser artifact delivery paths.

## Import trust boundary

Before XML parsing the ODT-specific ZIP reader enforces a 200 MiB input package limit (import entry point), 25 MiB per expanded part, 100 MiB total declared/actual expanded parts, and at most 4096 archive entries. Every STORE entry's actual byte length must match its declared size. DEFLATE is read incrementally; crossing actual size/part/aggregate limits cancels the stream before full output materialization. Successful reads are cached so a repeated part read does not consume its budget twice. CRC32 validates accidental/crafted corruption, not authenticity or a signature.

Local/central names, methods, flags, sizes and checksums are checked; overlapping payloads, duplicate/unsafe names, invalid bounds, symlinks, encryption, multidisk and ZIP64 are rejected. Data-descriptor entries use bounded central metadata and final output CRC/length validation. XML DTD/entities remain rejected. Embedded pictures are restricted to local package paths; the importer does not fetch remote images.

## Export fidelity

Every OMI-SPEC-225 source relationship unsupported by ODT produces structured `source-attribution-not-preserved` diagnostics and a corresponding warning in the existing delivery UI. Portable state is not mutated. Neither a visible citation nor a rights statement is fabricated to replace a semantic relation. Visual object fallback warnings remain separate.

Current covered subset: headings, basic inline formatting, lists, tables, notes and supported embedded images. ODT 1.3 output still requires independent schema/office interoperability and real-document acceptance before Stable promotion. Preview does not waive archive/security/privacy gates.

## Mandatory regression gates

`npm run test:odt` includes standard ODT fixtures plus security/loss cases: forged STORE and DEFLATE lengths, actual expansion cancellation, cumulative and entry quotas, CRC corruption, duplicate paths, local header corruption, truncation, data-descriptor compatibility, repeated-read accounting and source-link diagnostics without content disclosure or source mutation. The same tests run in the standard npm test suite. Fixtures are synthetic; do not add private manuscripts or filenames to CI.
