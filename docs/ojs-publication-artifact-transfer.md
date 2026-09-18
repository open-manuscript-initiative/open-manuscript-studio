# OJS publication artifact transfer

Open Manuscript Studio can transfer a validated publication artifact to an
existing unpublished OJS 3.5 submission in the Production stage.

This is different from direct author submission. Direct submission creates a new
PKP submission through the native author API; publication artifact transfer is
an editorial production operation for an existing article.

## Requirements

- OJS 3.5.x;
- Open Manuscript Studio Integration for OJS **1.5.0.0 or newer**;
- an enabled per-user OJS connection in Studio;
- a personal OJS API key belonging to an editorial user;
- the target submission must be in Production and its current publication
  version must still be unpublished.

HTML transfer also requires the OJS HTML Article Galley plugin. JATS and PDF do
not depend on that reader plugin.

## Supported formats

Studio reads the destination capabilities before offering a transfer. The OJS
1.5 protocol can advertise:

- self-contained HTML;
- JATS XML;
- print PDF;
- interactive PDF.

The format list and size limits come from the destination plugin instead of
being assumed by Studio.

## Workflow

1. Open a standalone OMI study.
2. In Publication, choose the OJS connection and enter the existing OJS
   submission ID.
3. Inspect the destination. Studio reads the current unpublished publication
   version, accepted locales, eligible file genres, supported artifact formats
   and provenance requirements.
4. Choose a format, locale and file genre.
5. Build the artifact. Studio checkpoints the current manuscript first.
6. Review the artifact filename, size, publication-build ID and SHA-256 digest.
   HTML receives an isolated preview; JATS can be inspected as XML.
7. Confirm the exact target and artifact.
8. Studio transfers the exact artifact bytes together with the full
   `omi-publication-build@0.1.0` manifest.

OJS rechecks editorial authorization and current publication state immediately
before persistence. The transferred galley remains **unapproved and
unpublished**. Native OJS editorial review and publication remain mandatory.

## Validation before transfer

The client uses the same publication pipeline as normal export.

For JATS this means:

- OMI renderer diagnostics;
- semantic-fidelity release gates;
- offline JATS4R publication profile;
- pinned JATS 1.4 Article Authoring / MathML 3 DTD validation.

For PDF, Studio renders the final bytes with the pinned Vivliostyle service and
records the exact renderer-input HTML digest.

HTML is self-contained and uses the existing restricted OJS galley policy.

### JATS ancillary assets

The current direct JATS protocol transfers one XML artifact. It does not yet
package ancillary binary files. Studio therefore blocks direct JATS transfer
when the XML refers to package-local binary media. Use HTML/PDF for a
self-contained visual artifact, or wait for the later JATS package/downstream
profile instead of creating a JATS galley with dangling local references.

## Provenance

Every transfer carries the exact publication-build manifest that corresponds to
the transferred bytes. OJS independently checks the manuscript identity,
revision/profile provenance, format, filename, media type, byte length,
SHA-256, renderer metadata and deterministic build identifier.

The `.omi-build.json` object is used for verification and is not exposed as a
public OJS galley. The OJS receipt returns the verified build ID and artifact
digest.

## Compatibility

The Studio server keeps the older HTML-only proxy for backwards compatibility,
but the Publication UI uses `omi-publication-artifact/1` when working with OJS
Integration 1.5.0.0 or newer.

The personal OJS API key is resolved on the Studio server and is sent only as
the native Bearer authorization header to the fixed, trusted OJS endpoint. It
is not placed in the artifact request body or stored in the publication-build
manifest.

## Verification

Run:

```bash
npm run test:publication-artifact
npm run test:publication-release
npm run build
```

The route tests verify connection ownership, trusted destination handling,
editor credential isolation, fixed-endpoint forwarding and preservation of OJS
403/409/422 responses. Artifact tests verify the Studio publication-build
payload and the JATS package-local-media boundary.

A real OJS 3.5 Production-stage acceptance run is still required for release
evidence; mocked route tests do not replace PKP installation testing.
