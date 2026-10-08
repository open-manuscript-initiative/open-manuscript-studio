# OMI file-format boundary in Studio

Open Manuscript Studio treats the portable OMI manuscript format as a versioned
contract that is independent from the Studio application release.

## Current standalone format

Studio emits and opens standalone `.omi.json` working manuscripts using:

| Boundary | Current value |
|---|---|
| File-format specification | `OMI-SPEC-320@0.2.0` |
| Canonical schema URI | `https://openmanuscript.org/schemas/omi-manuscript-0.2.schema.json` |
| `omi.format` | `manuscript` |
| `omi.version` | `0.2.0` |
| Studio working-file profiles | `core-snapshot`, `history-exchange` |

The application version, for example `0.2.0-beta.2`, is not the OMI
file-format version. The manuscript's application-defined `version` field is
also not the OMI file-format version.

Studio vendors the exact JSON Schema from the Open Manuscript Initiative specification repository and validates every imported and exported portable manuscript against it with JSON Schema Draft 2020-12. Existing semantic checks remain for cross-record invariants the schema cannot express. Studio runs the same version-pinned fixture corpus as the specification repository.

## Pre-0.2 files

The earlier Studio `omi-manuscript-0.1.json` representation was experimental
and was not used for production manuscripts. Studio therefore does not silently
migrate that standalone representation. A standalone file with the old schema
URI, a missing format envelope, or an unsupported `omi.version` is rejected
before it is loaded into the editor.

Backward-compatible migrations begin only after a format generation is declared
stable for production use. Any later migration must identify both its source and
target schema versions explicitly and must be covered by round-trip fixtures.

## Validation boundary

Standalone OMI JSON is validated before it becomes editable Studio state.
Studio currently enforces, among other invariants:

- the exact supported schema URI and `omi.version`;
- the `core-snapshot` profile and, for editable Studio working files, the
  `history-exchange` profile;
- required specification-version declarations;
- required manuscript identity, locale, title, timestamps and section structure;
- globally unique addressable identifiers within the portable document;
- resolvable contributor, annotation, citation, citation-cluster,
  cross-reference and revision references;
- agreement between the root and revision-history head identifiers;
- the required omission notice for shallow revision histories;
- exclusion of credential-like secret fields from portable manuscripts.

Serialization runs the same boundary checks. Studio therefore refuses to emit a
canonical OMI working file while required portable metadata, such as a non-empty
title, is missing.

## OMI containers

The physical `.omi` package is versioned separately under OMI-SPEC-330.
The current package architecture remains on its own Draft version line, while
its `manuscript/document.json` member uses the canonical
OMI-SPEC-320@0.2.0 core-snapshot representation. Revision history remains a
separate package member as defined by the current container architecture.

This separation is intentional:

- OMI-SPEC-320 versions the logical manuscript representation;
- OMI-SPEC-330 versions the package layout and integrity rules;
- Studio versions the implementation that consumes and produces both.

A change in one of these version lines does not implicitly change the others.


## Canonical schema and conformance fixtures

The vendored runtime schema is `src/schemas/omi-manuscript-0.2.schema.json`, pinned to
`OMI-SPEC-320@0.2.0` and its canonical schema URI. Studio uses Ajv 2020 with
date-time and URI format checks, followed by existing semantic invariants. It
never fetches a schema URI supplied by an input document.

The version-pinned manifest and all 13 fixtures are vendored under
`tests/fixtures/omi-spec-320/0.2.0/`. The suite checks validity and stable
diagnostic codes for malformed JSON, duplicate JSON members, structural failures,
duplicate identifiers, unresolved references, timestamp order, history-head
mismatch, and forbidden credential fields.

Run `npm run test:file-format` for the focused suite. The standard Studio test
suite also includes it. A green result proves the listed behaviors for this
Draft; it is not a full OMI 1.0 conformance claim.
