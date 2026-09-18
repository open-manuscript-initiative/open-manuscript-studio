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
- ignores the submitted external DOCTYPE for validation;
- parses submitted XML with network and external-entity loading disabled;
- loads the pinned JATS DTD and all of its modules separately through an
  in-memory resource provider;
- returns at most 100 validation diagnostics.

The submitted document therefore cannot choose a DTD, entity source, local file,
or network resource used by the validator.

## Export behavior

The editor can validate the current working preview explicitly. Download
creates the normal OMI checkpoint first, renders JATS from the committed
revision, and validates that committed XML. A DTD-invalid committed rendering
is not delivered as a validated JATS export.

This validation is a standards-conformance check. Publisher-specific profiles
or downstream services may impose additional constraints such as JATS4R,
Crossref, PubMed Central, or journal-specific requirements.
