# JATS 1.4 schema validation

Open Manuscript Studio validates generated JATS against the NISO JATS 1.4
Article Authoring DTD with MathML 3 before a validated export is delivered.

## Validation layers

Studio keeps two complementary checks:

1. the fast renderer-side structural diagnostics in `exportJats.ts`;
2. full server-side DTD validation using libxml2 through `xmllint-wasm`.

The server uses the JATS 1.4 schema files from the pinned
`@jats4r/dtds@0.0.10` package. Validation does not download DTDs or entities
from the network.

## Security boundary

The validation endpoint:

- requires an authenticated Studio session;
- limits XML input size;
- rejects input-side custom entity declarations and internal DTD subsets;
- replaces the submitted external DOCTYPE with the pinned local MathML 3 DTD;
- invokes xmllint with `--nonet --valid`;
- returns at most 100 validation diagnostics.

The validator therefore never treats a submitted remote SYSTEM identifier as a
network resource.

## Export behavior

The editor can validate the current working preview explicitly. Download
creates the normal OMI checkpoint first, renders JATS from the committed
revision, and validates that committed XML. A DTD-invalid committed rendering
is not delivered as a validated JATS export.

This validation is a standards-conformance check. Publisher-specific profiles
or downstream services may impose additional constraints such as JATS4R,
Crossref, PubMed Central, or journal-specific requirements.
