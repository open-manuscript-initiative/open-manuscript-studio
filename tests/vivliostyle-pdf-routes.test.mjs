import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

let calls = 0;
let failureCode = null;
const pageInspectionCalls = [];

class TestPdfError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

mock.module(
  new URL('../server/dist/middleware/requireSession.js', import.meta.url).href,
  {
    namedExports: {
      requireSession: (request, response, next) => {
        if (!request.headers['x-test-user']) return response.sendStatus(401);
        request.authUserId = request.headers['x-test-user'];
        next();
      },
    },
  },
);

mock.module(
  new URL('../server/dist/services/vivliostylePdfRenderer.js', import.meta.url).href,
  {
    namedExports: {
      MAX_VIVLIOSTYLE_HTML_BYTES: 48 * 1024 * 1024,
      VivliostylePdfError: TestPdfError,
      renderVivliostylePdf: async () => {
        calls += 1;
        if (failureCode) {
          throw new TestPdfError(failureCode, `renderer failure: ${failureCode}`);
        }
        return {
          bytes: new TextEncoder().encode('%PDF-1.7\n%%EOF\n'),
          renderer: 'vivliostyle-cli',
          rendererVersion: '11.0.4',
        };
      },
    },
  },
);

mock.module(
  new URL('../server/dist/security/pdfWorkerTransport.js', import.meta.url).href,
  {
    namedExports: {
      configuredPdfWorkerSocket: () => '/test/pdf-worker.sock',
      dispatchPdfWorkerTask: async (task, input, owner) => {
        pageInspectionCalls.push({ task, input, owner });
        return Buffer.from(JSON.stringify({ pageCount: 1, pages: ['Article'] }));
      },
    },
  },
);

const { publicationPdfRouter } = await import(
  '../server/dist/routes/publicationPdfRoutes.js'
);

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use('/publication', publicationPdfRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const originalFetch = globalThis.fetch;

async function request(body, user = 'editor') {
  const response = await originalFetch(
    `http://127.0.0.1:${server.address().port}/publication/render/pdf`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { 'x-test-user': user } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  const contentType = response.headers.get('content-type') ?? '';
  const responseBody = contentType.includes('application/pdf')
    ? new Uint8Array(await response.arrayBuffer())
    : await response.json().catch(() => null);
  return {
    status: response.status,
    cache: response.headers.get('cache-control'),
    contentType,
    disposition: response.headers.get('content-disposition'),
    renderer: response.headers.get('x-omi-pdf-renderer'),
    rendererVersion: response.headers.get('x-omi-pdf-renderer-version'),
    body: responseBody,
  };
}

test('PDF artifact API enforces authentication, input and renderer semantics', async (t) => {
  t.after(() => server.close());

  await t.test('requires an authenticated Studio session', async () => {
    assert.equal((await request({ html: '<html/>' }, null)).status, 401);
    assert.equal(calls, 0);
  });

  await t.test('rejects missing HTML before invoking the renderer', async () => {
    assert.equal((await request({})).status, 400);
    assert.equal(calls, 0);
  });

  await t.test('returns PDF bytes with renderer provenance headers and no-store', async () => {
    const result = await request({
      html: '<!doctype html><html><body>PDF</body></html>',
      fileName: 'article.pdf',
    });
    assert.equal(result.status, 200);
    assert.equal(result.cache, 'no-store');
    assert.match(result.contentType, /^application\/pdf/);
    assert.equal(result.disposition, 'attachment; filename="article.pdf"');
    assert.equal(result.renderer, 'vivliostyle-cli');
    assert.equal(result.rendererVersion, '11.0.4');
    assert.equal(new TextDecoder().decode(result.body).startsWith('%PDF-'), true);
    assert.equal(calls, 1);
  });

  await t.test('maps unavailable renderer to HTTP 503', async () => {
    failureCode = 'PDF_RENDERER_UNAVAILABLE';
    const result = await request({ html: '<html><body>PDF</body></html>' });
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, 'PDF_RENDERER_UNAVAILABLE');
    failureCode = null;
  });

  await t.test('maps unsafe input to HTTP 400', async () => {
    failureCode = 'PDF_INPUT_UNSAFE';
    const result = await request({ html: '<html><body>PDF</body></html>' });
    assert.equal(result.status, 400);
    assert.equal(result.body.error.code, 'PDF_INPUT_UNSAFE');
    failureCode = null;
  });

  await t.test('issue PDF inspection rejects non-binary bodies and invalid signatures before dispatch', async () => {
    const inspect = (body, mediaType, user = 'editor') => originalFetch(
      `http://127.0.0.1:${server.address().port}/publication/inspect/pdf-pages`,
      {
        method: 'POST',
        headers: { 'Content-Type': mediaType, ...(user ? { 'x-test-user': user } : {}) },
        body,
      },
    );
    const valid = Buffer.from('%PDF-1.7\n%%EOF\n');
    assert.equal((await inspect(valid, 'application/pdf', null)).status, 401);
    for (const [body, type] of [
      [JSON.stringify(['%PDF-1.7']), 'application/json'],
      [JSON.stringify({ type: 'Buffer', data: [37, 80, 68, 70, 45] }), 'application/json'],
      ['%PDF-1.7', 'text/plain'],
      ['%PDF', 'application/pdf'],
      [Buffer.from([0xa5, 0x50, 0x44, 0x46, 0x2d]), 'application/pdf'],
      ['', 'application/pdf'],
    ]) {
      const result = await inspect(body, type);
      assert.equal(result.status, 400);
      assert.equal((await result.json()).error.code, 'INVALID_ISSUE_PDF');
    }
    assert.equal(pageInspectionCalls.length, 0);
    const result = await inspect(valid, 'application/pdf');
    assert.equal(result.status, 200);
    assert.deepEqual(await result.json(), { pageCount: 1, pages: ['Article'] });
    assert.equal(pageInspectionCalls.length, 1);
    assert.equal(pageInspectionCalls[0].task, 'page-text');
    assert.equal(pageInspectionCalls[0].owner, 'editor');
    assert.deepEqual(pageInspectionCalls[0].input, valid);
  });

  await t.test('maps render failure to HTTP 422', async () => {
    failureCode = 'PDF_RENDER_FAILED';
    const result = await request({ html: '<html><body>PDF</body></html>' });
    assert.equal(result.status, 422);
    assert.equal(result.body.error.code, 'PDF_RENDER_FAILED');
    failureCode = null;
  });
});
