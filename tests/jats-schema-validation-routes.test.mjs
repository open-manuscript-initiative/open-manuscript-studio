import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

let shouldFail = false;
let calls = 0;

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
  new URL('../server/dist/services/jatsValidator.js', import.meta.url).href,
  {
    namedExports: {
      MAX_JATS_VALIDATION_BYTES: 6 * 1024 * 1024,
      validateJats14ArticleAuthoring: async () => {
        calls += 1;
        if (shouldFail) throw new Error('validator offline');
        return {
          standard: 'NISO JATS',
          version: '1.4',
          tagSet: 'articleauthoring',
          schema: 'DTD',
          schemaVariant: 'MathML3',
          schemaPackage: '@jats4r/dtds@0.0.10',
          engine: 'xmllint-wasm@5.3.0',
          valid: true,
          diagnostics: [],
        };
      },
    },
  },
);

const { publicationValidationRouter } = await import(
  '../server/dist/routes/publicationValidationRoutes.js'
);

const app = express();
app.use(express.json({ limit: '7mb' }));
app.use('/publication', publicationValidationRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const originalFetch = globalThis.fetch;

async function request(body, user = 'editor') {
  const response = await originalFetch(
    `http://127.0.0.1:${server.address().port}/publication/validate/jats`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(user ? { 'x-test-user': user } : {}),
      },
      body: JSON.stringify(body),
    },
  );
  return {
    status: response.status,
    cache: response.headers.get('cache-control'),
    body: await response.json().catch(() => null),
  };
}

test('JATS validation API enforces session, input and no-store semantics', async (t) => {
  t.after(() => server.close());

  await t.test('requires an authenticated Studio session', async () => {
    assert.equal((await request({ xml: '<article/>' }, null)).status, 401);
    assert.equal(calls, 0);
  });

  await t.test('rejects missing XML before invoking the validator', async () => {
    assert.equal((await request({})).status, 400);
    assert.equal(calls, 0);
  });

  await t.test('returns validator result without caching', async () => {
    const result = await request({ xml: '<article/>' });
    assert.equal(result.status, 200);
    assert.equal(result.cache, 'no-store');
    assert.equal(result.body.valid, true);
    assert.equal(result.body.version, '1.4');
    assert.equal(calls, 1);
  });

  await t.test('reports validator runtime failure as service unavailable', async () => {
    shouldFail = true;
    const result = await request({ xml: '<article/>' });
    assert.equal(result.status, 503);
    assert.equal(result.body.error.code, 'JATS_VALIDATOR_UNAVAILABLE');
    shouldFail = false;
  });
});
