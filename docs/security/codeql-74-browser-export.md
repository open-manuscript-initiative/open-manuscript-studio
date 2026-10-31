# CodeQL #74 — inert browser export object URLs

**Alert:** [GitHub code scanning #74](https://github.com/open-manuscript-initiative/open-manuscript-studio/security/code-scanning/74), `js/xss-through-dom` (High), originally at `src/services/exportFileDelivery.ts:169`. The warning identifies a possible DOM-to-HTML reinterpretation path when exporting authored document content through an object URL.

## Verified source and chosen security boundary

The existing browser exporter creates an object URL directly from a `Blob`, assigns it to an `<a>` element's `href`, sets the `download` name and clicks it. The file data can be authored HTML/XML and must not be treated as executable content inside Studio. Neither the source excerpt nor the alert screenshot alone establishes that a browser can be exploited; this is a conservative, high-severity hardening change.

`src/services/browserBlobDownload.ts` now makes a **byte-preserving** `Blob.slice(0, blob.size, 'application/octet-stream')` before creating a browser object URL. The resulting temporary object URL carries a non-renderable media type. The anchor is explicitly a download, carries `noopener noreferrer`, and is always removed. The object URL is revoked after a short delay (including after a failed click), avoiding early-revocation truncation on mobile browsers.

- The original document, HTML output, MIME declaration outside the browser download boundary, content, extension, provenance sidecar and native Tauri delivery remain unchanged.
- No `innerHTML`, HTML parsing, `javascript:`, `data:` navigation or content sanitization is introduced.
- This does **not** sanitize a standalone HTML file a user independently opens after download; HTML publication safety remains the responsibility of the dedicated export/publication pipeline.
- Browser download restrictions and multiple-download prompts remain browser-dependent.

## Regression evidence and acceptance

`tests/browser-blob-download.test.ts` checks:
1. Potentially active HTML markup is downloaded via an inert binary object URL with all authored bytes intact.
2. The anchor's download name, removal and deferred URL revocation are correct.
3. A thrown click still cleans up the anchor and URL.
4. Portable ZIP/OMI binary bytes are preserved.

Test is mandatory in `npm test`. Verify CodeQL on the **exact PR commit**: no unresolved `js/xss-through-dom` finding for the browser-export object-URL path. If CodeQL still flags the dataflow, inspect its full source-to-sink trace before deciding whether there is a residual risk, a model limitation or a required follow-up. **Do not automatically dismiss alert #74 as false positive.**

After PR review/merge, confirm HTML, DOCX, PDF, OMI and provenance-sidecar browser downloads in Chromium/Firefox and Android, with Unicode filenames and no unintended opening of the export as a Studio-origin page. No application version increase or auto deployment is part of this patch.
