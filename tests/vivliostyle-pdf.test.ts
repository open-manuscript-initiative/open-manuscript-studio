import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_VIVLIOSTYLE_HTML_BYTES,
  renderVivliostylePdf,
  validateVivliostyleHtmlInput,
  withOfflinePdfPolicy,
} from '../server/dist/services/vivliostylePdfRenderer.js';

test('Vivliostyle PDF source accepts self-contained resources and interactive links', () => {
  const html = `<!doctype html>
<html><head><style>
figure { background-image: url("data:image/svg+xml;base64,PHN2Zy8+"); }
</style></head><body>
<a href="https://doi.org/10.1234/example">DOI</a>
<img src="data:image/png;base64,iVBORw0KGgo=" alt="Example">
</body></html>`;

  assert.equal(validateVivliostyleHtmlInput(html), undefined);
});

test('Vivliostyle PDF source rejects active markup and remote subresources', () => {
  assert.match(
    validateVivliostyleHtmlInput('<html><body><script>alert(1)</script></body></html>') ?? '',
    /active/i,
  );
  assert.match(
    validateVivliostyleHtmlInput('<html><body><img src="https://example.test/image.png"></body></html>') ?? '',
    /non-embedded resource/i,
  );
  assert.match(
    validateVivliostyleHtmlInput('<style>@import "https://example.test/style.css";</style>') ?? '',
    /import/i,
  );
  assert.match(
    validateVivliostyleHtmlInput('<style>body{background:url(../secret.png)}</style>') ?? '',
    /non-embedded resource/i,
  );
});

test('PDF resource checks also reject unquoted HTML, SVG and srcset URLs', () => {
  for (const html of [
    '<img src=https://127.0.0.1/secret>',
    '<video poster=https://169.254.169.254/latest/meta-data/>',
    '<svg><image href=https://example.test/private></image></svg>',
    '<img srcset=https://example.test/image.png>',
  ]) {
    assert.match(validateVivliostyleHtmlInput(html) ?? '', /non-embedded/i, html);
  }
  assert.equal(
    validateVivliostyleHtmlInput('<img src=data:image/png;base64,iVBORw0KGgo=>'),
    undefined,
  );
});

test('PDF renderer policy precedes author-controlled content and forbids network loads', () => {
  const source = '<!doctype html><html><head><style>body{color:black}</style></head><body><p>Hello</p></body></html>';
  const protectedHtml = withOfflinePdfPolicy(source);
  assert.ok(protectedHtml.indexOf('Content-Security-Policy') < protectedHtml.indexOf('<style>'));
  assert.match(protectedHtml, /default-src 'none'/);
  assert.match(protectedHtml, /img-src data:/);
  assert.match(protectedHtml, /font-src data:/);
  assert.match(protectedHtml, /style-src 'unsafe-inline'/);
  assert.match(protectedHtml, /connect-src 'none'/);

  const fragment = withOfflinePdfPolicy('<p>Hello</p>');
  assert.ok(fragment.indexOf('Content-Security-Policy') < fragment.indexOf('<p>'));
});

test('Vivliostyle PDF source enforces the HTML size boundary', () => {
  const oversized = 'x'.repeat(MAX_VIVLIOSTYLE_HTML_BYTES + 1);
  assert.match(validateVivliostyleHtmlInput(oversized) ?? '', /limit/i);
});

if (process.env.OMI_RUN_VIVLIOSTYLE_SMOKE === '1') {
  test('pinned Vivliostyle CLI renders a real PDF artifact', async () => {
    const artifact = await renderVivliostylePdf(
      '<!doctype html><html><head><meta charset="utf-8"><style>@page{size:A5;margin:15mm}h1{break-after:avoid}</style></head><body><h1>OMI PDF smoke test</h1><p>Vivliostyle paged-media artifact.</p></body></html>',
    );

    assert.equal(artifact.renderer, 'vivliostyle-cli');
    assert.equal(artifact.rendererVersion, '11.0.4');
    assert.equal(new TextDecoder().decode(artifact.bytes.subarray(0, 5)), '%PDF-');
    assert.ok(artifact.bytes.byteLength > 500);
  });
}
