# Vivliostyle PDF artifacts

Open Manuscript Studio can produce a real paginated PDF artifact instead of
delegating PDF creation to the browser print dialog.

This is the second publication-output step built on the reproducible
publication-build foundation:

1. publication build provenance;
2. JATS 1.4 Article Authoring DTD validation;
3. **Vivliostyle PDF artifacts**;
4. **HTML/JATS/PDF build sidecars**;
5. broader conformance and release gates.

The authoritative source remains the committed OMI manuscript. PDF is a derived
publication artifact.

## Rendering pipeline

The Studio client:

1. creates an export checkpoint;
2. renders the selected publication or neutral editorial view as semantic HTML;
3. inlines referenced manuscript assets as data URLs;
4. sends the self-contained HTML to the authenticated Studio API;
5. receives the generated PDF bytes;
6. saves the PDF through the normal browser or native-app file delivery path.

The API executes Vivliostyle CLI as a separate process in an isolated temporary
directory. The renderer version is pinned to **11.0.4**. Its identifier and
version are returned in response headers and are recorded in the exported
publication-build sidecar.

## Server requirement

Vivliostyle CLI is deliberately not linked into the Studio npm dependency
graph. Install the pinned renderer separately on each API host:

```bash
npm install --global @vivliostyle/cli@11.0.4
vivliostyle --version
```

The service account that runs `omi-studio-api.service` must be able to execute
that binary and the browser used by Vivliostyle.

Supported environment variables:

```text
VIVLIOSTYLE_BIN=vivliostyle
VIVLIOSTYLE_EXECUTABLE_BROWSER=/path/to/chrome-or-chromium   # optional
VIVLIOSTYLE_TIMEOUT_SECONDS=180
```

If `VIVLIOSTYLE_EXECUTABLE_BROWSER` is omitted, Vivliostyle uses its configured
browser discovery/runtime behavior. Studio refuses a renderer version other
than 11.0.4 so artifact provenance does not silently change after a host update.

## Security boundary

The PDF endpoint requires a normal authenticated Studio session and is marked
`Cache-Control: no-store`.

The renderer accepts only self-contained HTML. It rejects:

- scripts, frames, embedded objects, forms, base elements and external link
  resources;
- CSS `@import`;
- non-embedded `src`, `srcset`, `poster`, object `data`, SVG
  `xlink:href` and CSS `url(...)` resources;
- oversized HTML and oversized generated PDFs.

External `<a href>` links remain permitted for the interactive PDF variant.
They are PDF link annotations, not render-time subresource requests.

The child process is started without a shell and receives only fixed
Vivliostyle arguments plus server-controlled paths. Temporary source and output
files are removed after every render.

## Output modes

The existing two independent PDF choices remain intact:

- **content**: typeset publication or neutral editorial manuscript;
- **interaction**: print/archive PDF or interactive PDF.

Print/archive mode strips active hyperlinks. Interactive mode keeps scholarly
links such as citations, note targets, ORCID/ROR identifiers and normal web
links.

## Provenance sidecar

Every PDF artifact exported through the standard or live-publication workflow
is accompanied by `<filename>.omi-build.json`. The manifest records the
committed manuscript revision, state digest, publication-profile digest, exact
PDF digest, Studio build identity, Vivliostyle version and a SHA-256 digest of
the exact self-contained HTML sent to the renderer.

The renderer-input digest is important for live publication output because it
captures the final pagination source after style, publisher identity,
typesetting corrections, hyphenation and asset inlining have been applied.
