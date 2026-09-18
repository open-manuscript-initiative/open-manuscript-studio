import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';

const connectionId = '20000000-0000-4000-8000-000000000003';
const destination = 'https://journal.example.test/index.php/demo';
let enabled = true;
let provider = 'ojs';
let remoteStatus = 200;
let trusted = true;
let calls = [];

mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: {
    prisma: {
      userIntegration: {
        findFirst: async ({ where }) =>
          where.id === connectionId &&
          where.userId === 'editor' &&
          where.enabled === enabled &&
          where.providerId === provider
            ? { id: connectionId, config: { baseUrl: destination } }
            : null,
      },
    },
  },
});
mock.module(
  new URL('../server/dist/middleware/requireSession.js', import.meta.url).href,
  {
    namedExports: {
      requireSession: (req, res, next) => {
        if (!req.headers['x-test-user']) return res.sendStatus(401);
        req.authUserId = req.headers['x-test-user'];
        next();
      },
    },
  },
);
mock.module(
  new URL(
    '../server/dist/integrations/security/trustedRemoteUrl.js',
    import.meta.url,
  ).href,
  {
    namedExports: {
      assertTrustedIntegrationUrl: async (url) => {
        if (!trusted) throw new Error('Untrusted destination');
        return new URL(url);
      },
    },
  },
);
mock.module(new URL('../server/dist/routes/authRoutes.js', import.meta.url).href, {
  namedExports: {
    resolvePersonalOjsCredential: async () => ({
      apiKey: 'editorial-test-key',
      baseUrl: destination,
    }),
  },
});

const { directSubmissionRouter } = await import(
  '../server/dist/routes/directSubmissionRoutes.js'
);
const app = express();
app.use(express.json({ limit: '48mb' }));
app.use(directSubmissionRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
const originalFetch = globalThis.fetch;

mock.method(globalThis, 'fetch', async (url, init) => {
  if (!String(url).startsWith(destination)) {
    return originalFetch(url, init);
  }
  calls.push({
    url: String(url),
    init,
    body: JSON.parse(init.body),
  });

  const body = JSON.parse(init.body);
  const success =
    body.action === 'inspect'
      ? {
          protocol: 'omi-publication-artifact/1',
          submissionId: 12,
          publicationId: 13,
          title: 'Demo',
          locales: ['hu'],
          genres: [{ id: 2, label: 'Article' }],
          formats: [
            {
              id: 'html',
              label: 'HTML',
              mediaType: 'text/html',
              extension: 'html',
              maxBytes: 8388608,
              available: true,
              requires: 'htmlArticleGalleyPlugin',
            },
            {
              id: 'jats',
              label: 'JATS XML',
              mediaType: 'application/xml',
              extension: 'xml',
              maxBytes: 8388608,
              available: true,
              requires: null,
            },
          ],
          provenance: {
            required: true,
            model: 'omi-publication-build',
            version: '0.1.0',
            digest: 'sha256',
          },
          published: false,
        }
      : {
          protocol: 'omi-publication-artifact/1',
          submissionId: 12,
          publicationId: 13,
          format: body.format,
          mediaType: body.mediaType,
          artifactFileName: body.fileName,
          galleyId: 14,
          submissionFileId: 15,
          sha256: 'a'.repeat(64),
          buildId: body.build.id,
          provenanceVerified: true,
          unchanged: false,
          published: false,
        };

  return new Response(
    JSON.stringify(
      remoteStatus === 200
        ? success
        : { error: { message: 'Rejected editorial-test-key' } },
    ),
    { status: remoteStatus, headers: { 'Content-Type': 'application/json' } },
  );
});

const inspect = {
  action: 'inspect',
  manuscriptId: 'demo-study',
  submissionId: 12,
};
const build = {
  model: 'omi-publication-build',
  version: '0.1.0',
  id: 'urn:omi:publication-build:sha256:' + 'b'.repeat(64),
  createdAt: '2026-09-18T12:00:00.000Z',
  manuscript: {
    id: 'demo-study',
    revisionId: 'revision-1',
    stateDigest: {
      algorithm: 'sha256',
      value: '1'.repeat(64),
      canonicalization: 'omi-manuscript-state-json-v1',
    },
  },
  profile: {
    id: 'default',
    version: '1',
    digest: {
      algorithm: 'sha256',
      value: '2'.repeat(64),
      canonicalization: 'omi-publication-profile-json-v1',
    },
  },
  output: {
    format: 'jats',
    mediaType: 'application/xml',
    fileName: 'article.jats.xml',
    byteLength: 4,
    digest: { algorithm: 'sha256', value: '3'.repeat(64) },
  },
  generator: {
    application: 'open-manuscript-studio',
    applicationVersion: '0.2.0-beta.1',
    renderer: 'open-manuscript-studio-jats',
    rendererVersion: '0.1.0-alpha.1',
  },
};
const transfer = {
  ...inspect,
  action: 'transfer',
  publicationId: 13,
  locale: 'hu',
  genreId: 2,
  format: 'jats',
  mediaType: 'application/xml',
  fileName: 'article.jats.xml',
  artifactBase64: Buffer.from('<a/>').toString('base64'),
  build,
  confirmed: true,
};

async function request(body = inspect, user = 'editor') {
  const response = await originalFetch(
    'http://127.0.0.1:' + server.address().port +
      '/integrations/connections/' + connectionId + '/publication-artifact',
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

test('publication artifact proxy authorization and protocol', async (t) => {
  t.after(() => server.close());

  await t.test('requires a session and the owner enabled OJS connection', async () => {
    assert.equal((await request(inspect, null)).status, 401);
    assert.equal((await request(inspect, 'another-user')).status, 404);
    enabled = false;
    assert.equal((await request()).status, 404);
    enabled = true;
    provider = 'omp';
    assert.equal((await request()).status, 404);
    provider = 'ojs';
    assert.equal(calls.length, 0);
  });

  await t.test('rejects incomplete transfer and untrusted destinations', async () => {
    assert.equal(
      (await request({ ...transfer, confirmed: undefined })).status,
      400,
    );
    assert.equal(
      (await request({ ...transfer, build: undefined })).status,
      400,
    );
    trusted = false;
    assert.equal((await request()).status, 502);
    trusted = true;
    assert.equal(calls.length, 0);
  });

  await t.test('forwards the editor key only as Bearer to the fixed plugin endpoint', async () => {
    const inspected = await request();
    assert.equal(inspected.status, 200);
    assert.equal(inspected.cache, 'no-store');
    assert.equal(inspected.body.target.publicationId, 13);
    assert.equal(
      calls[0].url,
      destination + '/api/v1/omi-integration/publication-artifact',
    );
    assert.equal(
      calls[0].init.headers.get('Authorization'),
      'Bearer editorial-test-key',
    );
    assert.equal(calls[0].init.redirect, 'error');
    assert.equal(calls[0].body.apiKey, undefined);

    const transferred = await request(transfer);
    assert.equal(transferred.status, 200);
    assert.equal(transferred.body.receipt.provenanceVerified, true);
    assert.equal(transferred.body.receipt.published, false);
    assert.equal(transferred.body.receipt.buildId, build.id);
  });

  await t.test('preserves OJS permission/conflict/validation status without exposing key', async () => {
    for (const status of [403, 409, 422]) {
      remoteStatus = status;
      const result = await request(transfer);
      assert.equal(result.status, status);
      assert.doesNotMatch(
        JSON.stringify(result.body),
        /editorial-test-key/,
      );
    }
    remoteStatus = 200;
  });
});
