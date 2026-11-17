import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { after, mock, test } from 'node:test';
import express from '../server/node_modules/express/index.js';
const submissionId = '10000000-0000-4000-8000-000000000001';
const editorId = '20000000-0000-4000-8000-000000000002';
const authorId = '30000000-0000-4000-8000-000000000003';
const workerId = '40000000-0000-4000-8000-000000000004';
let editorEnabled = true;
let acceptanceFailure = false;
const acceptanceInputs = [];
let liveDelivery = false;
let submission = {
  id: submissionId,
  workspaceId: 'native:test',
  manuscriptId: 'manuscript',
  publicationVenueId: 'venue',
  authorUserId: authorId,
  title: 'Article',
  status: 'ACCEPTED',
  revisionId: 'rev1',
  stateDigest: 'a'.repeat(64),
  publicationContentDigest: 'b'.repeat(64),
  manuscriptStateSnapshot: { id: 'manuscript' },
  reviewSnapshot: {},
  assets: [],
  production: null,
};
let files = [];
const hash = (v) => createHash('sha256').update(v).digest('hex');
const canonical = (v) =>
  Array.isArray(v)
    ? `[${v.map(canonical).join(',')}]`
    : v && typeof v === 'object'
      ? `{${Object.keys(v)
          .sort()
          .map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`)
          .join(',')}}`
      : JSON.stringify(v);
const db = {
  nativeEditorialSubmission: {
    findUnique: async ({ where }) =>
      where.id === submissionId ? submission : null,
    findUniqueOrThrow: async () => submission,
    findMany: async () => [submission],
    update: async ({ data }) => { Object.assign(submission, data); return submission; },
  },
  webPublicationDelivery: { findFirst: async () => liveDelivery ? { id: 'delivery' } : null },
  nativeEditorialSubmissionAsset: { deleteMany: async () => { submission.assets = []; }, createMany: async () => {} },
  editorialDecision: { findUniqueOrThrow: async () => ({ reviewRound: 1, basisAssignmentIds: ['scientific-review'] }) },
  editorialProduction: {
    create: async ({ data }) => {
      submission.production = { ...data, version: 1 };
      return submission.production;
    },
    updateMany: async ({ where, data }) => {
      if (submission.production.version !== where.version) return { count: 0 };
      submission.production.state = data.state;
      submission.production.version++;
      return { count: 1 };
    },
  },
  editorialProductionFile: {
    create: async ({ data }) => {
      files.push({ ...data, createdAt: new Date() });
      return data;
    },
    findMany: async () => files.map(({ bytes: _bytes, build: _build, ...file }) => file),
    findFirst: async ({ where }) =>
      files.find((f) => Object.entries(where).every(([k, v]) => f[k] === v)) ??
      null,
    findFirstOrThrow: async ({ where }) => {
      const f = files.find((f) =>
        Object.entries(where).every(([k, v]) => f[k] === v),
      );
      if (!f) throw Error('File missing');
      return f;
    },
  },
  user: { findFirst: async () => ({ id: workerId }) },
  $queryRaw: async () => [],
};
db.$transaction = async (callback) => {
  const before = structuredClone({ submission, files });
  try {
    return await callback(db);
  } catch (error) {
    submission = before.submission;
    files = before.files;
    throw error;
  }
};
mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma: db },
});
mock.module(
  new URL(
    '../server/dist/services/publicationVenueAuthorityService.js',
    import.meta.url,
  ).href,
  {
    namedExports: {
      assertStudioNativePublicationVenue: async () => ({}),
      assertStudioNativePublicationVenueEditorAuthority: async (userId) => {
        if (userId !== editorId || !editorEnabled) {
          const e = new Error('No venue authority');
          e.name = 'ForbiddenError';
          throw e;
        }
      },
    },
  },
);
mock.module(
  new URL(
    '../server/dist/services/nativeEditorialWorkflowService.js',
    import.meta.url,
  ).href,
  {
    namedExports: {
      ensureSubmissionEditorAccess: async () => {},
      validateRevisionInput: (input) => ({ ...input, assets: [] }),
    },
  },
);
mock.module(
  new URL(
    '../server/dist/services/editorialDecisionService.js',
    import.meta.url,
  ).href,
  {
    namedExports: {
      createEditorialAcceptance: async (_userId, input, tx) => {
        assert.equal(tx, db, 'source acceptance must use the production transaction');
        if (acceptanceFailure) throw Error('Synthetic decision failure');
        acceptanceInputs.push(input);
        return {};
      },
    },
  },
);
mock.module(
  new URL('../server/dist/middleware/requireSession.js', import.meta.url).href,
  {
    namedExports: {
      requireSession: (req, res, next) => {
        if (!req.headers['x-user']) return res.sendStatus(401);
        req.authUserId = req.headers['x-user'];
        next();
      },
    },
  },
);
const { editorialProductionRouter } = await import(
  '../server/dist/routes/editorialProductionRoutes.js'
);
const { assertNativeProductionReady, validateProductionProof } = await import(
  '../server/dist/services/editorialProductionService.js'
);
const app = express();
app.use(express.json({ limit: '2mb' }));
app.use('/production', editorialProductionRouter);
const server = await new Promise((resolve) => {
  const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
});
after(() => server.close());
const base = `http://127.0.0.1:${server.address().port}/production/${submissionId}`;
async function request(
  userId,
  command,
  version = submission.production?.version ?? 0,
) {
  return fetch(base, {
    method: command ? 'POST' : 'GET',
    headers: {
      ...(userId ? { 'x-user': userId } : {}),
      'Content-Type': 'application/json',
    },
    ...(command ? { body: JSON.stringify({ version, command }) } : {}),
  });
}
async function change(userId, command) {
  const response = await request(userId, command);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}
function artifact() {
  const html = '<!doctype html><html><body>Exact proof</body></html>';
  const identity = {
    model: 'omi-publication-build',
    version: '0.1.0',
    manuscript: {
      id: 'manuscript',
      revisionId: submission.revisionId,
      stateDigest: {
        algorithm: 'sha256',
        value: submission.stateDigest,
        canonicalization: 'omi-manuscript-state-json-v1',
      },
    },
    profile: {
      id: 'journal',
      version: '1',
      digest: {
        algorithm: 'sha256',
        value: 'd'.repeat(64),
        canonicalization: 'omi-publication-profile-json-v1',
      },
    },
    generator: {
      application: 'open-manuscript-studio',
      applicationVersion: '1.0.0-rc.2',
      renderer: 'studio-web',
      rendererVersion: '1',
    },
    output: {
      format: 'html',
      fileName: 'article.html',
      mediaType: 'text/html;charset=utf-8',
      byteLength: Buffer.byteLength(html),
      digest: { algorithm: 'sha256', value: hash(html) },
    },
  };
  const build = {
    ...identity,
    id: `urn:omi:publication-build:sha256:${hash(canonical(identity))}`,
    createdAt: new Date().toISOString(),
  };
  return {
    type: 'PROOF',
    artifactBase64: Buffer.from(html).toString('base64'),
    build,
  };
}
test('native production API protects persisted transitions, exact proof bytes, and publication readiness', async () => {
  assert.equal((await request(null)).status, 401);
  assert.equal((await request(workerId)).status, 403);
  assert.equal((await request(authorId, { type: 'START' })).status, 403);
  let data = await change(editorId, { type: 'START' });
  assert.equal(files.length, 1);
  assert.equal(
    JSON.parse(Buffer.from(files[0].bytes).toString()).revisionId,
    'rev1',
  );
  const firstVersion = data.version;
  assert.equal(
    (await request(editorId, { type: 'READY', actor: { editor: true } }))
      .status,
    400,
  );
  assert.equal((await request(editorId, { type: 'READY' })).status, 409);
  await assert.rejects(
    assertNativeProductionReady({
      userId: editorId,
      manuscriptId: 'manuscript',
      revisionId: 'rev1',
    }),
    /Complete production/,
  );
  data = await change(authorId, {
    type: 'APPROVE_SOURCE',
    role: 'AUTHOR',
    fileId: data.state.source.fileId,
  });
  assert.equal(
    (await request(editorId, { type: 'LAYOUT' }, firstVersion)).status,
    409,
    'stale tab cannot overwrite newer approvals',
  );
  await change(editorId, {
    type: 'APPROVE_SOURCE',
    role: 'EDITOR',
    fileId: data.state.source.fileId,
  });
  await change(editorId, { type: 'LAYOUT' });
  const proof = artifact();
  assert.equal(
    (
      await request(editorId, {
        ...proof,
        artifactBase64: Buffer.from('tampered').toString('base64'),
      })
    ).status,
    409,
  );
  assert.equal(files.length, 1, 'invalid bytes leave no persisted file');
  data = await change(editorId, proof);
  const fileId = data.state.proof.fileId;
  const file = await fetch(`${base}/files/${fileId}`, {
    headers: { 'x-user': authorId },
  });
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-disposition'), /^attachment;/);
  assert.match(file.headers.get('content-security-policy'), /sandbox/);
  assert.equal(
    hash(Buffer.from(await file.arrayBuffer())),
    proof.build.output.digest.value,
  );
  assert.equal(
    (
      await fetch(`${base}/files/90000000-0000-4000-8000-000000000009`, {
        headers: { 'x-user': authorId },
      })
    ).status,
    404,
  );
  await change(editorId, {
    type: 'ASSIGN',
    email: 'worker@example.org',
    role: 'PROOFREADER',
  });
  assert.equal((await request(workerId)).status, 200);
  assert.equal(
    (await request(workerId, { type: 'APPROVE_PROOF', role: 'EDITOR', fileId }))
      .status,
    403,
  );
  await change(editorId, {
    type: 'REVOKE',
    userId: workerId,
    role: 'PROOFREADER',
  });
  assert.equal((await request(workerId)).status, 403);
  await change(authorId, { type: 'APPROVE_PROOF', role: 'AUTHOR', fileId });
  await change(editorId, { type: 'APPROVE_PROOF', role: 'EDITOR', fileId });
  await change(editorId, { type: 'READY' });
  await assertNativeProductionReady({
    userId: editorId,
    manuscriptId: 'manuscript',
    revisionId: 'rev1',
    artifactSha256: proof.build.output.digest.value,
  });
  await assert.rejects(
    assertNativeProductionReady({
      userId: editorId,
      manuscriptId: 'manuscript',
      revisionId: 'rev1',
      artifactSha256: 'f'.repeat(64),
    }),
    /exact proof/,
  );
  await assert.rejects(
    assertNativeProductionReady({
      userId: authorId,
      manuscriptId: 'manuscript',
      revisionId: 'rev1',
    }),
    /active venue editor/,
  );
  liveDelivery = true;
  assert.equal((await request(editorId, { type: 'SOURCE', source: { manuscriptId: 'manuscript', title: 'Changed article', revisionId: 'rev2', stateDigest: 'e'.repeat(64), publicationContentDigest: 'f'.repeat(64), manuscriptStateSnapshot: { id: 'manuscript', title: 'Changed article', metadata: { publicationVenue: { id: 'venue' } } }, reviewSnapshot: {}, assets: [] } })).status, 409);
  liveDelivery = false;
  const initialBytes = Buffer.from(files[0].bytes).toString('hex');
  data = await change(editorId, { type: 'SOURCE', source: { manuscriptId: 'manuscript', title: 'Changed article', revisionId: 'rev2', stateDigest: 'e'.repeat(64), publicationContentDigest: 'f'.repeat(64), manuscriptStateSnapshot: { id: 'manuscript', title: 'Changed article', metadata: { publicationVenue: { id: 'venue' } } }, reviewSnapshot: {}, assets: [] } });
  assert.equal(data.state.stage, 'COPYEDITING');
  assert.equal(data.state.proof, null);
  await change(authorId, { type: 'APPROVE_SOURCE', role: 'AUTHOR', fileId: data.state.source.fileId });
  await change(editorId, { type: 'APPROVE_SOURCE', role: 'EDITOR', fileId: data.state.source.fileId });
  acceptanceFailure = true;
  assert.equal((await request(editorId, { type: 'LAYOUT' })).status, 500);
  assert.equal(submission.revisionId, 'rev1', 'failed acceptance cannot promote the source');
  assert.equal(submission.production.state.stage, 'COPYEDITING');
  acceptanceFailure = false;
  await change(editorId, { type: 'LAYOUT' });
  assert.equal(submission.revisionId, 'rev2');
  assert.equal(acceptanceInputs.at(-1).revisionId, 'rev2');
  assert.equal(Buffer.from(files[0].bytes).toString('hex'), initialBytes, 'initial accepted source remains intact');
  editorEnabled = false;
  assert.equal(
    (await request(editorId)).status,
    403,
    'old workspace access cannot replace active venue authority',
  );
  editorEnabled = true;
  submission.status = 'PUBLISHED';
  assert.equal(
    (await request(editorId, { type: 'PROOF', ...proof })).status,
    409,
  );
});
test('proof validator rejects malformed encoding, wrong identity, format and unsafe filenames', () => {
  const state = submission.production.state;
  const p = artifact();
  assert.throws(() =>
    validateProductionProof('***', p.build, 'manuscript', state),
  );
  assert.throws(() =>
    validateProductionProof(
      p.artifactBase64,
      p.build,
      'other-manuscript',
      state,
    ),
  );
  assert.throws(() =>
    validateProductionProof(
      p.artifactBase64,
      { ...p.build, id: 'forged' },
      'manuscript',
      state,
    ),
  );
});

test('proof validation checks complete provenance, safe names and PDF structure after identity verification', () => {
  const state = submission.production.state;
  const p = artifact();
  const resign = (build) => { const { id: _id, createdAt: _createdAt, ...identity } = build; return { ...build, id: `urn:omi:publication-build:sha256:${hash(canonical(identity))}` }; };
  assert.equal(validateProductionProof(p.artifactBase64, p.build, 'manuscript', state).sha256, p.build.output.digest.value);
  assert.throws(() => validateProductionProof(p.artifactBase64, resign({ ...p.build, output: { ...p.build.output, fileName: '../article.html' } }), 'manuscript', state), /filename/);
  assert.throws(() => validateProductionProof(p.artifactBase64, { ...p.build, generator: undefined }, 'manuscript', state), /complete publication-build/);
  const pdf = resign({ ...p.build, output: { ...p.build.output, format: 'pdf-print', fileName: 'article.pdf', mediaType: 'application/pdf' }, rendererInput: { mediaType: 'text/html', byteLength: 1, digest: { algorithm: 'sha256', value: '1'.repeat(64) } } });
  assert.throws(() => validateProductionProof(p.artifactBase64, pdf, 'manuscript', state), /Invalid PDF/);
});
