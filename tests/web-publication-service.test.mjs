import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mock, test } from 'node:test';

const userId = '10000000-0000-4000-8000-000000000001';
const connectionId = '20000000-0000-4000-8000-000000000002';
const connection = {
  id: connectionId,
  userId,
  providerId: 'web-publishing',
  authenticationMode: 'none',
  enabled: true,
  config: { endpoint: 'https://publisher.example.test/omi' },
  encryptedSecret: null,
  updatedAt: new Date('2026-09-22T08:00:00.000Z'),
};

let delivery = null;
let grant = null;
let externalPublication = null;
let remoteCalls = [];
let editorialEvidenceCalls = [];
let failSuccessAudit = false;

const reviewedEvidence = {
  type: 'studio-editorial-decision',
  decisionId: '60000000-0000-4000-8000-000000000006',
  evidenceDigest: '6'.repeat(64),
  publicationContentDigest: '0'.repeat(64),
  reviewRound: 2,
  decidedAt: '2026-09-22T07:30:00.000Z',
};

function applyData(row, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && 'increment' in value) {
      row[key] = (row[key] ?? 0) + value.increment;
    } else {
      row[key] = value;
    }
  }
  row.updatedAt = new Date();
  return row;
}

const deliveryTable = {
  findUnique: async ({ where }) => {
    if (!delivery) return null;
    const key = where.userId_idempotencyKey;
    return key && delivery.userId === key.userId &&
      delivery.idempotencyKey === key.idempotencyKey
      ? delivery
      : where.id === delivery.id ? delivery : null;
  },
  findUniqueOrThrow: async ({ where }) => {
    if (!delivery || delivery.id !== where.id) throw new Error('Missing delivery');
    return delivery;
  },
  create: async ({ data }) => {
    delivery = {
      id: '30000000-0000-4000-8000-000000000003',
      ...data,
      deliveredContentDigest: null,
      attemptCount: 0,
      externalId: null,
      externalUrl: null,
      lastError: null,
      completedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return delivery;
  },
  upsert: async ({ where, create }) => {
    const existing = await deliveryTable.findUnique({ where });
    return existing ?? deliveryTable.create({ data: create });
  },
  updateMany: async ({ where, data }) => {
    if (!delivery || delivery.id !== where.id || delivery.userId !== where.userId) {
      return { count: 0 };
    }
    if (delivery.state === 'IN_FLIGHT') return { count: 0 };
    applyData(delivery, data);
    return { count: 1 };
  },
  update: async ({ where, data }) => {
    if (!delivery || delivery.id !== where.id) throw new Error('Missing delivery');
    return applyData(delivery, data);
  },
};

const grantTable = {
  create: async ({ data }) => {
    grant = {
      id: '40000000-0000-4000-8000-000000000004',
      ...data,
      consumedAt: null,
      createdAt: new Date(),
    };
    return grant;
  },
  findFirst: async ({ where }) => {
    return grant && delivery && grant.userId === where.userId &&
      grant.deliveryId === where.deliveryId
      ? { ...grant, delivery }
      : null;
  },
  updateMany: async ({ where, data }) => {
    if (!grant || grant.id !== where.id || grant.consumedAt) return { count: 0 };
    Object.assign(grant, data);
    return { count: 1 };
  },
};

const publicationTable = {
  findUnique: async () => externalPublication,
  upsert: async ({ update, create }) => {
    externalPublication = externalPublication
      ? applyData(externalPublication, update)
      : { id: '50000000-0000-4000-8000-000000000005', ...create, createdAt: new Date(), updatedAt: new Date() };
    return externalPublication;
  },
};

const prisma = {
  userIntegration: {
    findFirst: async ({ where }) => where.id === connection.id &&
      where.userId === connection.userId && connection.enabled
      ? connection
      : null,
  },
  webPublicationDelivery: deliveryTable,
  webPublicationApprovalGrant: grantTable,
  webPublication: publicationTable,
  $transaction: async (operation) => operation({
    webPublicationDelivery: deliveryTable,
    webPublicationApprovalGrant: grantTable,
    webPublication: publicationTable,
  }),
};

mock.module(new URL('../server/dist/lib/prisma.js', import.meta.url).href, {
  namedExports: { prisma },
});
mock.module(
  new URL('../server/dist/integrations/integrationAudit.js', import.meta.url).href,
  {
    namedExports: {
      writeIntegrationAuditEvent: async (event) => {
        if (
          failSuccessAudit &&
          event.operation === 'web-publication.deliver' &&
          event.status === 'SUCCESS'
        ) {
          throw new Error('Synthetic audit failure after remote success');
        }
      },
    },
  },
);
mock.module(
  new URL('../server/dist/services/editorialDecisionService.js', import.meta.url).href,
  {
    namedExports: {
      assertEditorialDecisionEvidence: async (input) => {
        editorialEvidenceCalls.push(input);
        return {
          ...reviewedEvidence,
          publicationContentDigest: input.publicationContentDigest,
        };
      },
    },
  },
);
mock.module(
  new URL(
    '../server/dist/integrations/security/trustedRemoteUrl.js',
    import.meta.url,
  ).href,
  { namedExports: { assertTrustedIntegrationUrl: async (value) => new URL(value) } },
);
mock.module(
  new URL('../server/dist/integrations/secretCrypto.js', import.meta.url).href,
  { namedExports: { decryptSecret: () => 'test-secret' } },
);

const {
  executeWebPublicationDelivery,
  issueWebPublicationApproval,
} = await import('../server/dist/integrations/publishing/webPublication.js');

mock.method(globalThis, 'fetch', async (url, init) => {
  remoteCalls.push({
    url: String(url),
    idempotencyKey: new Headers(init.headers).get('Idempotency-Key'),
    body: JSON.parse(init.body),
  });
  return new Response(
    JSON.stringify({ externalId: 'article-42', externalUrl: 'https://publisher.example.test/articles/42' }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});

test('web publication service binds target version, rejects hidden seals, and receipts delivered bytes', async () => {
  reset();
  const input = approvalInput();
  const approved = await issueWebPublicationApproval(userId, input);

  assert.ok(approved.grant);
  assert.equal(delivery.connectionVersion.toISOString(), input.connectionVersion);
  assert.equal(delivery.contentDigest, sha256(input.artifact.html));

  connection.updatedAt = new Date('2026-09-22T08:01:00.000Z');
  await assert.rejects(
    executeWebPublicationDelivery(
      userId,
      approved.grant.deliveryId,
      approved.grant.executionToken,
    ),
    (error) => error?.code === 'WEB_PUBLICATION_TARGET_CHANGED',
  );
  assert.equal(remoteCalls.length, 0);

  connection.updatedAt = new Date(input.connectionVersion);
  const receipt = await executeWebPublicationDelivery(
    userId,
    approved.grant.deliveryId,
    approved.grant.executionToken,
  );
  assert.equal(receipt.deliveryState, 'succeeded');
  assert.equal(receipt.connectionVersion, input.connectionVersion);
  assert.equal(receipt.contentDigest, sha256(input.artifact.html));
  assert.equal(receipt.deliveredContentDigest, receipt.contentDigest);
  assert.equal(remoteCalls.length, 1);
  assert.equal(remoteCalls[0].body.protocol, 'omi-web-publication/1');
  assert.equal(remoteCalls[0].idempotencyKey, input.idempotencyKey);

  reset();
  const hidden = approvalInput({ hiddenSeal: true });
  await assert.rejects(
    issueWebPublicationApproval(userId, hidden),
    (error) => error?.code === 'WEB_PUBLICATION_ARTIFACT_INVALID',
  );
  assert.equal(delivery, null);

  reset();
  const reviewed = approvalInput({ reviewed: true });
  const reviewedApproval = await issueWebPublicationApproval(userId, reviewed);
  assert.ok(reviewedApproval.grant);
  assert.equal(editorialEvidenceCalls.length, 1);
  assert.deepEqual(editorialEvidenceCalls[0], {
    userId,
    manuscriptId: reviewed.manuscriptId,
    revisionId: reviewed.artifact.build.manuscript.revisionId,
    stateDigest: reviewed.artifact.build.manuscript.stateDigest.value,
    publicationContentDigest: reviewed.assurance.evidence.publicationContentDigest,
    decisionId: reviewedEvidence.decisionId,
    evidenceDigest: reviewedEvidence.evidenceDigest,
  });
});

test('reviewed approval rejects changed article bytes even with a valid old decision id', async () => {
  reset();
  const reviewed = approvalInput({ reviewed: true });
  const acceptedContentDigest = reviewed.assurance.evidence.publicationContentDigest;
  reviewed.artifact.html = reviewed.artifact.html.replace(
    '<h1>Synthetic article</h1>',
    '<h1>Synthetic article changed after editorial acceptance</h1>',
  );
  reviewed.artifact.build = publicationBuild(reviewed.artifact.html);
  reviewed.idempotencyKey = `tampered-reviewed:${reviewed.artifact.build.id}`;

  assert.notEqual(digestPublicationArticle(reviewed.artifact.html), acceptedContentDigest);
  await assert.rejects(
    issueWebPublicationApproval(userId, reviewed),
    (error) => error?.code === 'WEB_PUBLICATION_ASSURANCE_INVALID',
  );
  assert.equal(delivery, null);
});

test('web publication rejects hidden ancestors and active navigation metadata', async () => {
  reset();
  const hidden = approvalInput();
  hidden.artifact.html = hidden.artifact.html.replace(
    '<article class="omi-scholarly-article">',
    '<article class="omi-scholarly-article" hidden>',
  );
  hidden.artifact.build = publicationBuild(hidden.artifact.html);
  hidden.idempotencyKey = `hidden-ancestor:${hidden.artifact.build.id}`;
  await assert.rejects(
    issueWebPublicationApproval(userId, hidden),
    (error) => error?.code === 'WEB_PUBLICATION_ARTIFACT_INVALID',
  );

  reset();
  const refresh = approvalInput();
  refresh.artifact.html = refresh.artifact.html.replace(
    '<title>Synthetic article</title>',
    '<meta http-equiv="refresh" content="0;url=https://attacker.example/"><title>Synthetic article</title>',
  );
  refresh.artifact.build = publicationBuild(refresh.artifact.html);
  refresh.idempotencyKey = `meta-refresh:${refresh.artifact.build.id}`;
  await assert.rejects(
    issueWebPublicationApproval(userId, refresh),
    (error) => error?.code === 'WEB_PUBLICATION_ARTIFACT_INVALID',
  );

  reset();
  const srcset = approvalInput();
  srcset.artifact.html = srcset.artifact.html.replace(
    '<h1>Synthetic article</h1>',
    '<img src="data:image/png;base64,AA==" srcset="https://attacker.example/a.png 2x"><h1>Synthetic article</h1>',
  );
  srcset.artifact.build = publicationBuild(srcset.artifact.html);
  srcset.idempotencyKey = `srcset:${srcset.artifact.build.id}`;
  await assert.rejects(
    issueWebPublicationApproval(userId, srcset),
    (error) => error?.code === 'WEB_PUBLICATION_ARTIFACT_INVALID',
  );
});

test('unknown delivery outcomes require reconciliation instead of automatic resend', async () => {
  reset();
  const input = approvalInput();
  const approved = await issueWebPublicationApproval(userId, input);
  delivery.state = 'UNKNOWN';

  await assert.rejects(
    executeWebPublicationDelivery(
      userId,
      approved.grant.deliveryId,
      approved.grant.executionToken,
    ),
    (error) => error?.code === 'WEB_PUBLICATION_RECONCILIATION_REQUIRED',
  );
  assert.equal(remoteCalls.length, 0);
});

test('audit failure after stored remote success never downgrades delivery to retryable unknown', async () => {
  reset();
  const input = approvalInput();
  const approved = await issueWebPublicationApproval(userId, input);
  failSuccessAudit = true;

  await assert.rejects(
    executeWebPublicationDelivery(
      userId,
      approved.grant.deliveryId,
      approved.grant.executionToken,
    ),
    (error) => error?.code === 'WEB_PUBLICATION_AUDIT_FAILED_AFTER_DELIVERY',
  );
  assert.equal(remoteCalls.length, 1);
  assert.equal(delivery.state, 'SUCCEEDED');
  assert.equal(delivery.artifactHtml, null);
});

function reset() {
  delivery = null;
  grant = null;
  externalPublication = null;
  remoteCalls = [];
  editorialEvidenceCalls = [];
  failSuccessAudit = false;
  connection.updatedAt = new Date('2026-09-22T08:00:00.000Z');
}

function approvalInput(options = {}) {
  const assurance = options.reviewed
    ? {
        model: 'omi-publication-assurance',
        version: '1',
        intent: 'popular-science',
        reviewStatus: 'peer-reviewed',
        approvalAuthority: 'studio-editorial-decision',
        disclosure: 'visible-and-machine-readable',
        evidence: { ...reviewedEvidence },
      }
    : {
        model: 'omi-publication-assurance',
        version: '1',
        intent: 'popular-science',
        reviewStatus: 'not-peer-reviewed',
        approvalAuthority: 'authenticated-account-holder',
        disclosure: 'visible-and-machine-readable',
      };
  const html = publicationHtml(assurance, options.hiddenSeal === true);
  if (assurance.reviewStatus === 'peer-reviewed') {
    assurance.evidence.publicationContentDigest = digestPublicationArticle(html);
  }
  const build = publicationBuild(html);
  return {
    connectionId,
    connectionVersion: connection.updatedAt.toISOString(),
    manuscriptId: 'synthetic-study',
    title: 'Synthetic public-interest article',
    status: 'draft',
    assurance,
    artifact: { html, build },
    idempotencyKey: `web-publication-service-test:${build.id}`,
    confirmation: 'account-holder-approves-exact-web-publication-v1',
  };
}

function publicationHtml(assurance, hiddenSeal) {
  const asideDisplay = hiddenSeal ? 'display:none' : 'display:flex!important';
  const reviewed = assurance.reviewStatus === 'peer-reviewed';
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head>',
    '  <meta charset="utf-8">',
    '  <meta name="omi-manuscript-id" content="synthetic-study">',
    '  <meta name="omi-head-revision" content="revision-1">',
    `  <meta name="omi-state-digest-sha256" content="${'1'.repeat(64)}">`,
    `  <meta name="omi-publication-intent" content="${assurance.intent}">`,
    `  <meta name="omi-review-status" content="${assurance.reviewStatus}">`,
    `  <meta name="omi-approval-authority" content="${assurance.approvalAuthority}">`,
    ...(reviewed
      ? [
          `  <meta name="omi-editorial-decision-id" content="${assurance.evidence.decisionId}">`,
          `  <meta name="omi-editorial-evidence-sha256" content="${assurance.evidence.evidenceDigest}">`,
        ]
      : []),
    '  <title>Synthetic article</title>',
    '</head>',
    '<body>',
    '  <article class="omi-scholarly-article">',
    `    <aside class="omi-publication-assurance omi-publication-assurance--${assurance.reviewStatus}"`,
    '      data-omi-assurance-version="1"',
    `      data-omi-publication-intent="${assurance.intent}"`,
    `      data-omi-review-status="${assurance.reviewStatus}"`,
    ...(reviewed
      ? [`      data-omi-editorial-decision-id="${assurance.evidence.decisionId}"`]
      : []),
    `      style="${asideDisplay};visibility:visible!important;opacity:1!important"`,
    '      role="note">',
    `      <span class="omi-publication-assurance__seal" aria-hidden="true" style="display:inline-grid!important;visibility:visible!important">${reviewed ? 'OMI\nPEER REVIEW\nVERIFIED' : 'OMI\nPEER REVIEW\nNOT VERIFIED'}</span>`,
    '      <span class="omi-publication-assurance__copy"><strong>Popular-science publication.</strong> No scholarly peer review is verified.</span>',
    '    </aside>',
    '    <h1>Synthetic article</h1>',
    '  </article>',
    '</body>',
    '</html>',
  ].join('\n');
}

function digestPublicationArticle(html) {
  const article = html.match(
    /<article\b[^>]*class="[^"]*omi-scholarly-article[^"]*"[^>]*>[\s\S]*?<\/article>/i,
  )?.[0];
  assert.ok(article);
  const disclosures = Array.from(
    article.matchAll(
      /\n {4}<aside\b[^>]*class="[^"]*omi-publication-assurance[^"]*"[^>]*>[\s\S]*?<\/aside>/gi,
    ),
  );
  assert.equal(disclosures.length, 1);
  return sha256(article.replace(disclosures[0][0], ''));
}

function publicationBuild(html) {
  const build = {
    model: 'omi-publication-build',
    version: '0.1.0',
    createdAt: '2026-09-22T08:00:00.000Z',
    manuscript: {
      id: 'synthetic-study',
      revisionId: 'revision-1',
      stateDigest: {
        algorithm: 'sha256',
        value: '1'.repeat(64),
        canonicalization: 'omi-manuscript-state-json-v1',
      },
    },
    profile: {
      id: 'generic-scholarly',
      version: '1',
      digest: {
        algorithm: 'sha256',
        value: '2'.repeat(64),
        canonicalization: 'omi-publication-profile-json-v1',
      },
    },
    output: {
      format: 'html',
      mediaType: 'text/html;charset=utf-8',
      fileName: 'synthetic-study.html',
      byteLength: new TextEncoder().encode(html).byteLength,
      digest: { algorithm: 'sha256', value: sha256(html) },
    },
    generator: {
      application: 'open-manuscript-studio',
      applicationVersion: '0.2.0-beta.4',
      renderer: 'open-manuscript-studio-web-publication',
      rendererVersion: '0.1.0+html-0.1.0',
    },
  };
  const identity = { ...build };
  delete identity.createdAt;
  return {
    ...build,
    id: `urn:omi:publication-build:sha256:${sha256(canonicalJson(identity))}`,
  };
}

function sha256(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function canonicalJson(value) {
  if (value === null) return 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value);
  }
  return `{${Object.keys(value).sort().map((key) =>
    `${JSON.stringify(key)}:${canonicalJson(value[key])}`
  ).join(',')}}`;
}
