/**
 * Trigger a browser download without giving an authored HTML/XML document an
 * executable MIME type at the browser's object-URL boundary.
 *
 * The bytes and the requested filename are preserved: only the *transient*
 * Blob media type is made inert. This is important for scholarly HTML exports,
 * whose contents may contain authored markup but must not be navigated as a
 * same-origin page merely because a download link was created.
 *
 * Keep this operation synchronous so a two-file export (artifact + sidecar)
 * can initiate both downloads within the originating user gesture.
 */
export function downloadBlobInBrowser(blob: Blob, fileName: string): void {
  // Blob.slice() preserves all bytes; its third argument changes only the MIME
  // type assigned to the temporary download URL. Never treat document text as
  // HTML in the Studio DOM or insert it via innerHTML.
  const downloadBlob = blob.slice(0, blob.size, 'application/octet-stream');
  const objectUrl = URL.createObjectURL(downloadBlob);
  // The href is not authored document text: it must be an opaque URL minted
  // by the browser for this exact binary Blob. Reject any unexpected scheme,
  // and percent-encode HTML metacharacters at the URL/DOM boundary.
  // encodeURI preserves the standard blob:<origin>/<uuid> syntax.
  const safeDownloadUrl = encodeURI(objectUrl);
  if (!safeDownloadUrl.startsWith('blob:') || /[<>"'\s]/.test(safeDownloadUrl)) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Browser refused an unsafe export object URL');
  }

  let link: HTMLAnchorElement | undefined;
  try {
    link = document.createElement('a');
    link.href = safeDownloadUrl;
    link.download = fileName;
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
  } finally {
    link?.remove();
    // Immediate revocation can interrupt downloads on mobile/Safari. Revoke
    // after the browser has had time to hand the URL to its download manager,
    // including when click() throws, so object URLs do not accumulate.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 30_000);
  }
}
