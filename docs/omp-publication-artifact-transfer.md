# OMP publication artifact transfer

Open Manuscript Studio can transfer a validated publication artifact to an
existing unpublished Open Monograph Press 3.5 submission in the Production
stage.

This is an editorial production operation for an existing OMP submission. It
is separate from direct author submission, which creates a new submission
through the native PKP author API.

## Requirements

- OMP 3.5.x;
- Open Manuscript Studio Integration for OMP **1.4.0.0 or newer**;
- an enabled per-user OMP connection in Studio;
- a personal OMP API key belonging to an editorial user, stored encrypted in
  the separate Studio identity/profile database;
- the target submission must be in Production and its current publication
  version must still be unpublished.

The OMP integration shared secret is not used as an editor credential.

## Supported output

Studio inspects the destination before it enables transfer. OMP 1.4 can
advertise:

- self-contained HTML;
- JATS XML;
- print PDF;
- interactive PDF.

For a standalone OMI study, Studio can prepare all four output types when the
destination supports them. For an OMI volume/monograph, Studio currently offers
print and interactive PDF only. The existing HTML and JATS renderers have
article/study semantics and are not silently reused for a whole volume.

HTML transfer additionally requires OMP's HTML Monograph File plugin.

## Workflow

1. Open the OMI study or volume.
2. In Publication, choose an OMP connection and enter the existing OMP
   submission ID.
3. Inspect the destination.
4. Studio verifies that the OMP plugin advertises
   `omi-publication-artifact/1`, `omi-publication-build@0.1.0`, and the
   required native authority defaults.
5. Choose an available format, locale, and OMP file genre.
6. Studio checkpoints the manuscript and builds the artifact through the normal
   publication pipeline.
7. Review filename, size, build ID, SHA-256, and HTML/JATS preview when
   applicable.
8. Confirm the exact target and transfer.
9. OMP independently rechecks authorization, provenance, artifact bytes, and
   current publication state before persistence.

## OMP authority boundary

The client requires the destination to advertise:

```text
representation = publicationFormat
formatApprovedByDefault = false
formatAvailableByDefault = false
proofViewableByDefault = false
```

A successful new transfer is expected to create or reuse a native OMP
Publication Format and store a `SUBMISSION_FILE_PROOF`. Studio verifies that a
new receipt still reports the format as unapproved/unavailable and the proof as
non-viewable.

Transfer does not:

- publish the monograph;
- approve the Publication Format;
- make the format available in the catalog;
- make the proof viewable;
- replace OMP editorial authority.

If the OMP editor has already approved/made available a format or made a proof
viewable, the plugin rejects a changed Studio artifact with HTTP 409. An exact
idempotent retry remains safe.

## Provenance

Studio sends the exact `omi-publication-build@0.1.0` manifest for the exact
transferred bytes. OMP independently verifies manuscript identity, committed
revision/state digest, publication profile, output metadata, byte length,
SHA-256, renderer metadata, optional PDF renderer-input provenance, and the
deterministic build URN.

The provenance object is verification data; it is not published as a separate
proof file.

## Credentials and trust boundary

The personal OMP API key is resolved only on the Studio server and sent as a
Bearer header to the fixed trusted OMP endpoint. It is never placed in the
artifact body or publication-build manifest.

OJS and OMP editor credentials are stored separately. Selecting an OMP
connection can never cause Studio to forward the saved OJS key, and vice versa.

## Verification

Run:

```bash
npm run test:publication-artifact
npm run test:publication-release
npm run build
```

The route tests verify both OJS and OMP connection ownership, trusted
destination handling, provider-specific credential isolation, fixed endpoint
forwarding, OMP authority metadata, and preservation of PKP 403/409/422
responses.

A real OMP 3.5 Production-stage acceptance run remains the final
installation-level release verification.
