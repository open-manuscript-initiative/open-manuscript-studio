import assert from 'node:assert/strict';
import test from 'node:test';

import {
  MAX_VIVLIOSTYLE_HTML_BYTES,
  validateVivliostyleHtmlInput,
} from '../server/src/services/vivliostylePdfRenderer.ts';

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

test('Vivliostyle PDF source enforces the HTML size boundary', () => {
  const oversized = 'x'.repeat(MAX_VIVLIOSTYLE_HTML_BYTES + 1);
  assert.match(validateVivliostyleHtmlInput(oversized) ?? '', /limit/i);
});
