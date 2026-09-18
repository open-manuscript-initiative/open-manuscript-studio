# JATS 1.4 schema validation

Open Manuscript Studio validates generated JATS against the NISO JATS 1.4
Article Authoring DTD with MathML 3 before a validated export is delivered.

## Validation layers

Studio keeps two complementary checks:

1. the fast renderer-side structural diagnostics in `exportJats.ts`;
2. full server-side DTD validation using libxml2 through
   `libxml2-wasm@0.7.2`.

The server uses the JATS 1.4 schema files from the pinned
`@jats4r/dtds@0.0.10` package. Validation does not download DTDs or entities
from the network.

## Security boundary

The validation endpoint:

- requires an authenticated Studio session;
- limits XML input size;
- rejects input-side custom entity declarations and internal DTD subsets;
- replaces any submitted external DOCTYPE with the pinned JATS 1.4
  Article Authoring MathML 3 DTD;
- disables network access and the system XML catalog;
- resolves the trusted modular JATS DTD only through the in-memory schema set;
- returns at most 100 validation diagnostics.

DTD module/entity loading is enabled because modular JATS requires external
parameter entities, but the submitted document cannot choose those resources:
its entity declarations are rejected and its DOCTYPE is replaced before
validation.

## Export behavior

The editor can validate the current working preview explicitly. Download
creates the normal OMI checkpoint first, renders JATS from the committed
revision, and validates that committed XML. A DTD-invalid committed rendering
is not delivered as a validated JATS export.

This validation is a standards-conformance check. Publisher-specific profiles
or downstream services may impose additional constraints such as JATS4R,
Crossref, PubMed Central, or journal-specific requirements.
