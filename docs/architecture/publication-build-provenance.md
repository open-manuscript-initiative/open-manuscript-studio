# Publication build provenance

Open Manuscript Studio treats publication files as reproducible build artifacts,
not as additional canonical manuscript sources.

The authoritative scholarly source remains the committed OMI manuscript state.
A publication build records the exact inputs and generator identity used to
produce one exported artifact.

## Model

A publication build manifest records:

- manuscript identity;
- committed revision identity;
- SHA-256 digest of the committed manuscript state;
- publication-profile identity and version;
- a canonical SHA-256 digest of the complete publication profile;
- output format, media type, filename, byte length and SHA-256 digest;
- Studio version/build/commit information when available;
- renderer name and renderer version;
- for PDF builds, SHA-256 provenance for the exact self-contained HTML input
  passed to the renderer;
- build creation time.

The build identifier is deterministic and has the form:

```text
urn:omi:publication-build:sha256:<digest>
```

The digest is calculated from the provenance identity excluding `createdAt`.
Generating the same bytes from the same committed revision, profile, renderer
input and generator therefore yields the same build identifier even at a
different time.

For paged PDF output, the optional `rendererInput` block fingerprints the
exact self-contained HTML consumed by Vivliostyle. This captures live
publication-style, publisher-identity, correction and embedded-asset effects
even when those values are not part of the canonical manuscript state.

## Commit boundary

A manifest may only be created when the current manuscript state matches the
committed head revision. Export workflows must create a checkpoint first when
working changes exist.

This prevents a manifest from claiming that an artifact came from revision
`R` when it was actually rendered from later, uncommitted changes.

## Profile identity

Publication-profile provenance includes both `id@version` and a canonical
profile digest.

The digest detects accidental or unauthorized mutation of a profile without a
version bump and includes presentation assets embedded in the profile, such as
publisher export/print CSS.

## Sidecar delivery

Studio emits build sidecars automatically for JATS, HTML publication packages
and PDF artifacts after the export checkpoint succeeds. The same behavior is
used by the standard export surface and the dedicated JATS/HTML and live
publication export surfaces.

On the web the artifact and sidecar are downloaded together. Desktop Tauri
builds ask for the artifact path once and write the sidecar next to the final
selected path. Mobile document providers require a second save operation
because they do not expose a writable sibling filesystem path.

HTML ZIP timestamps are derived from the committed revision timestamp rather
than the current clock so identical committed input produces identical package
bytes and therefore a stable artifact digest.

## Artifact verification

Consumers can verify an exported file against the manifest using its declared
byte length and SHA-256 digest.

The sidecar naming convention is:

```text
<artifact filename>.omi-build.json
```

Examples:

```text
article.xml
article.xml.omi-build.json

article.pdf
article.pdf.omi-build.json

article.html.zip
article.html.zip.omi-build.json
```

Publication build manifests intentionally live outside the OMI manuscript
semantic state. Exporting a manuscript does not create or modify scholarly
content and therefore does not create a new revision by itself.
