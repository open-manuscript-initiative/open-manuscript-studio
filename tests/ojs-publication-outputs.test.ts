import { createAssetMetadata } from '../src/model/assets.ts';
import { putAssetPayload } from '../src/services/assetRepository.ts';
import assert from 'node:assert/strict';
import { listOjsIssueTransferTargets, issueArtifactInspectRequest, assertIssueArtifactTarget } from '../src/model/ojsIssueTransferTargets.ts';
import test from 'node:test';
import { prepareOjsIssueBatch, type IssueBatchDependencies, type IssueBatchSelection } from '../src/app/ojsIssueBatchActions.ts';
import {
  createInitialVersioningEnvelope,
  extractManuscriptState,
} from '../src/model/versioning.ts';
import { resolvePublicationProfile } from '../src/model/publicationProfile.ts';
import {
  assertOjsProductionTarget,
  prepareOjsPublicationOutputs,
  transferOjsPublicationOutputs,
} from '../src/app/ojsPublicationActions.ts';
import {
  prepareStyledPublicationArtifact,
  publicationLayoutKey,
} from '../src/services/styledPublicationArtifact.ts';
import {
  clonePublicationStyleTemplate,
  clonePublicationPublisherTemplate,
} from '../src/services/publicationStyleExport.ts';
import {
  calculatePublicationProfileDigest,
  createPublicationBuildManifest,
  verifyPublicationBuildArtifact,
} from '../src/services/publicationBuildManifest.ts';
import type {
  PublicationArtifactTarget,
  PublicationArtifactReceipt,
  PublicationArtifactRequest,
} from '../src/services/publicationArtifact.ts';
import { createHtmlGalleyStudy } from './fixtures/htmlGalleyStudy.ts';
function study() {
  const state = extractManuscriptState(createHtmlGalleyStudy());
  return {
    ...state,
    ...createInitialVersioningEnvelope(state, {
      summary: 'Synthetic live publication',
      timestamp: state.updatedAt,
      completeness: 'complete',
    }),
  };
}
function context() {
  const style = clonePublicationStyleTemplate();
  style.styles.body.fontSize = 13.7;
  style.page.width = 173;
  style.runningHeaders.enabled = true;
  const identity = clonePublicationPublisherTemplate();
  identity.publisherName = 'Synthetic publisher';
  identity.legal.copyright.copyrightHolder = 'Synthetic publisher';
  return { style, identity };
}
function target(): PublicationArtifactTarget {
  return {
    protocol: 'omi-publication-artifact/1',
    submissionId: 12,
    publicationId: 13,
    title: 'Synthetic article',
    locales: ['hu'],
    genres: [{ id: 2, label: 'Article' }],
    workflowToken: 'a'.repeat(64),
    published: false,
    provenance: {
      required: true,
      model: 'omi-publication-build',
      version: '0.1.0',
      digest: 'sha256',
    },
    formats: ['html', 'pdf-print', 'pdf-interactive'].map((id) => ({
      id: id as 'html' | 'pdf-print' | 'pdf-interactive',
      label: id,
      mediaType: id === 'html' ? 'text/html' : 'application/pdf',
      extension: id === 'html' ? 'html' : 'pdf',
      maxBytes: 32 * 1024 * 1024,
      available: true,
      requires: null,
    })),
  };
}
const fakePdf = async () => ({
  blob: new Blob(['%PDF-1.7\nSynthetic proof\n%%EOF'], {
    type: 'application/pdf',
  }),
  renderer: 'synthetic-pdf',
  rendererVersion: '1',
});
const prepare = (
  source: ReturnType<typeof study>,
  format: 'html' | 'pdf-print' | 'pdf-interactive',
  layout: ReturnType<typeof context>,
) => prepareStyledPublicationArtifact(source, format, layout, fakePdf);
function receipt(
  request: PublicationArtifactRequest,
): PublicationArtifactReceipt {
  if (request.action !== 'transfer') throw Error('Unexpected inspect');
  return {
    protocol: 'omi-publication-artifact/1',
    submissionId: request.submissionId,
    publicationId: request.publicationId,
    format: request.format,
    mediaType: request.mediaType,
    artifactFileName: request.fileName,
    galleyId: request.format === 'html' ? 21 : 22,
    submissionFileId: 31,
    sha256: request.build.output.digest.value,
    buildId: request.build.id,
    provenanceVerified: true,
    unchanged: false,
    published: false,
  };
}

test('live HTML applies the exact publisher style and preserves semantic article structure without changing the source', async () => {
  const source = study(),
    layout = context(),
    before = JSON.stringify(source);
  const output = await prepare(source, 'html', layout);
  assert.match(output.previewText!, /data-omi-publication-style="html"/);
  assert.match(output.previewText!, /13\.7pt/);
  assert.match(output.previewText!, /<table/);
  assert.match(output.previewText!, /Synthetic publisher/);
  assert.equal(
    output.build.profile.digest.value,
    calculatePublicationProfileDigest({
      ...resolvePublicationProfile(source),
      publicationStyle: layout.style,
    }),
  );
  assert.equal(
    verifyPublicationBuildArtifact(output.build, output.bytes),
    true,
  );
  assert.equal(output.layoutKey, publicationLayoutKey(layout));
  assert.equal(JSON.stringify(source), before);
  const changed = context();
  changed.style.styles.body.fontSize = 17;
  const next = await prepare(source, 'html', changed);
  assert.notEqual(
    next.build.profile.digest.value,
    output.build.profile.digest.value,
  );
  assert.notEqual(next.build.id, output.build.id);
});

test('live PDF feeds the same page geometry and publisher style to the built-in renderer with exact input provenance', async () => {
  const source = study(),
    layout = context();
  let rendered = '';
  const output = await prepareStyledPublicationArtifact(
    source,
    'pdf-print',
    layout,
    async (html) => {
      rendered = html;
      return fakePdf();
    },
  );
  assert.match(rendered, /data-omi-publication-style="print"/);
  assert.match(rendered, /173mm/);
  assert.match(rendered, /13\.7pt/);
  assert.match(rendered, /data-omi-print-running-headers/);
  assert.equal(
    output.build.rendererInput!.byteLength,
    new TextEncoder().encode(rendered).length,
  );
  assert.equal(
    verifyPublicationBuildArtifact(output.build, output.bytes),
    true,
  );
  await assert.rejects(
    prepareStyledPublicationArtifact(source, 'pdf-print', layout, async () => ({
      blob: new Blob(['not PDF']),
      renderer: 'bad',
      rendererVersion: '1',
    })),
    /invalid/,
  );
});

test('style snapshot survives concurrent edits while rendering', async () => {
  const source = study(),
    layout = context(),
    original = structuredClone(layout);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const job = prepareStyledPublicationArtifact(
    source,
    'pdf-print',
    layout,
    async () => {
      await waiting;
      return fakePdf();
    },
  );
  layout.style.styles.body.fontSize = 30;
  release();
  const output = await job;
  assert.equal(output.layoutKey, publicationLayoutKey(original));
  assert.notEqual(output.layoutKey, publicationLayoutKey(layout));
});

test('selection controls preparation and unsupported or oversized outputs never become a transfer batch', async () => {
  const source = study(),
    layout = context(),
    destination = target();
  let calls = 0;
  const outputs = await prepareOjsPublicationOutputs(
    source,
    layout,
    destination,
    ['html'],
    async (...args) => {
      calls++;
      return prepare(...args);
    },
  );
  assert.deepEqual(
    outputs.map((item) => item.format),
    ['html'],
  );
  assert.equal(calls, 1);
  destination.formats[0].available = false;
  await assert.rejects(
    prepareOjsPublicationOutputs(
      source,
      layout,
      destination,
      ['html'],
      prepare,
    ),
    /does not accept/,
  );
  destination.formats[0].available = true;
  destination.formats[0].maxBytes = 1;
  await assert.rejects(
    prepareOjsPublicationOutputs(
      source,
      layout,
      destination,
      ['html'],
      prepare,
    ),
    /exceeds/,
  );
  await assert.rejects(
    prepareOjsPublicationOutputs(source, layout, target(), [], prepare),
    /Select/,
  );
  await assert.rejects(
    prepareOjsPublicationOutputs(
      source,
      layout,
      target(),
      ['pdf-print', 'pdf-interactive'],
      prepare,
    ),
    /one PDF/,
  );
  assert.throws(
    () =>
      assertOjsProductionTarget({
        ...target(),
        published: true,
      } as unknown as PublicationArtifactTarget),
    /unpublished/,
  );
  assert.throws(
    () => assertOjsProductionTarget({ ...target(), workflowToken: undefined }),
    /Inspect/,
  );
});

test('HTML and PDF transfer retain OJS authority, exact workflow token and matching per-file receipts', async () => {
  const source = study(),
    layout = context(),
    destination = target();
  const outputs = await prepareOjsPublicationOutputs(
    source,
    layout,
    destination,
    ['html', 'pdf-print'],
    prepare,
  );
  const requests: PublicationArtifactRequest[] = [];
  const result = await transferOjsPublicationOutputs({
    source,
    contextKey: publicationLayoutKey(layout),
    target: destination,
    locale: 'hu',
    genreId: 2,
    outputs,
    currentSource: () => source,
    currentContextKey: () => publicationLayoutKey(layout),
    isDestinationCurrent: () => true,
    send: async (request) => {
      requests.push(request);
      return { receipt: receipt(request) };
    },
  });
  assert.equal(result.failed, undefined);
  assert.equal(result.receipts.length, 2);
  for (const request of requests) {
    assert.equal(request.action, 'transfer');
    if (request.action === 'transfer') {
      assert.equal(request.expectedWorkflowToken, destination.workflowToken);
      assert.equal(request.confirmed, true);
    }
  }
  assert.equal(
    result.receipts.every((item) => item.published === false),
    true,
  );
});

test('local content or style changes stop transfer; a mid-batch change preserves the already confirmed HTML', async () => {
  const source = study(),
    layout = context(),
    destination = target(),
    outputs = await prepareOjsPublicationOutputs(
      source,
      layout,
      destination,
      ['html', 'pdf-print'],
      prepare,
    );
  let changed = false,
    calls = 0;
  const input = {
    source,
    contextKey: publicationLayoutKey(layout),
    target: destination,
    locale: 'hu',
    genreId: 2,
    outputs,
    currentSource: () => (changed ? structuredClone(source) : source),
    currentContextKey: () => publicationLayoutKey(layout),
    isDestinationCurrent: () => true,
    send: async (request: PublicationArtifactRequest) => {
      calls++;
      changed = true;
      return { receipt: receipt(request) };
    },
  };
  const result = await transferOjsPublicationOutputs(input);
  assert.equal(calls, 1);
  assert.equal(result.receipts.length, 1);
  assert.equal(result.failed?.format, 'pdf-print');
  changed = false;
  calls = 0;
  layout.style.page.width = 180;
  const stale = await transferOjsPublicationOutputs(input);
  assert.equal(calls, 0);
  assert.equal(stale.receipts.length, 0);
});

test('lost response or mismatched receipt stops the batch without replay or losing a confirmed first file', async () => {
  const source = study(),
    layout = context(),
    destination = target(),
    outputs = await prepareOjsPublicationOutputs(
      source,
      layout,
      destination,
      ['html', 'pdf-print'],
      prepare,
    );
  let calls = 0;
  const base = {
    source,
    contextKey: publicationLayoutKey(layout),
    target: destination,
    locale: 'hu',
    genreId: 2,
    outputs,
    currentSource: () => source,
    currentContextKey: () => publicationLayoutKey(layout),
    isDestinationCurrent: () => true,
  };
  const partial = await transferOjsPublicationOutputs({
    ...base,
    send: async (request) => {
      calls++;
      if (calls === 2) throw Error('Synthetic lost response');
      return { receipt: receipt(request) };
    },
  });
  assert.equal(calls, 2);
  assert.equal(partial.receipts.length, 1);
  assert.equal(partial.failed?.format, 'pdf-print');
  calls = 0;
  const mismatch = await transferOjsPublicationOutputs({
    ...base,
    send: async (request) => {
      calls++;
      return { receipt: { ...receipt(request), sha256: '0'.repeat(64) } };
    },
  });
  assert.equal(calls, 1);
  assert.equal(mismatch.receipts.length, 0);
  assert.ok(mismatch.failed);
});

test('styled PDF retains registered SVG figures while HTML reports its existing raster-only limit', async () => {
  const draft = createHtmlGalleyStudy();
  const bytes = new TextEncoder().encode(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10" fill="red"/></svg>',
  );
  const asset = await createAssetMetadata(bytes, {
    id: 'svg-style-figure',
    mediaType: 'image/svg+xml',
    fileName: 'figure.svg',
  });
  draft.assets = [asset];
  draft.sections[0].blocks.push({
    id: 'svg-figure',
    type: 'image',
    content: '',
    visual: {
      kind: 'image',
      assetId: asset.id,
      src: '',
      mediaType: asset.mediaType,
      fileName: asset.fileName,
      alt: 'Synthetic SVG',
    },
  });
  await putAssetPayload(draft.id, asset.id, bytes);
  const state = extractManuscriptState(draft),
    source = {
      ...state,
      ...createInitialVersioningEnvelope(state, {
        summary: 'SVG fixture',
        timestamp: state.updatedAt,
        completeness: 'complete',
      }),
    };
  let html = '';
  await prepareStyledPublicationArtifact(
    source,
    'pdf-print',
    context(),
    async (input) => {
      html = input;
      return fakePdf();
    },
  );
  assert.match(html, /src="data:image\/svg\+xml;base64,/);
  await assert.rejects(
    prepare(source, 'html', context()),
    /Unsupported publication image/,
  );
});

test('issue writeback targets follow current study order and require exact remote identity', () => {
  const source = extractManuscriptState(study());
  source.sections = [{ id: 'b', title: 'Second', blocks: [] }, { id: 'a', title: 'First', blocks: [] }, { id: 'local', title: 'Local only', blocks: [] }];
  source.extensions = { ...source.extensions, 'org.openmanuscript.ojs.issue': {
    version: 1, installationId: 'installation-one', context: { externalId: '5' }, issue: { externalId: '7' },
    sections: [{ articles: [
      { rootSectionId: 'a', submissionExternalId: '12', publicationExternalId: '13' },
      { rootSectionId: 'b', submissionExternalId: '14', publicationExternalId: '15' },
      { rootSectionId: 'deleted', submissionExternalId: '16', publicationExternalId: '17' },
    ] }],
  }};
  const targets = listOjsIssueTransferTargets(source);
  assert.deepEqual(targets.map(t => t.rootSectionId), ['b', 'a']);
  assert.deepEqual(issueArtifactInspectRequest(targets[1]!, 'document'), {
    action: 'inspect', manuscriptId: 'document', submissionId: 12, publicationId: 13,
    expectedIssueId: 7, expectedInstallationId: 'installation-one',
  });
  const remote = { ...target(), issueId: 7, contextId: 5, installationId: 'installation-one' };
  assert.doesNotThrow(() => assertIssueArtifactTarget(targets[1]!, remote));
  for (const incorrect of [{ issueId: 8 }, { contextId: 6 }, { publicationId: 99 }, { installationId: 'other' }, { workflowToken: undefined }]) {
    assert.throws(() => assertIssueArtifactTarget(targets[1]!, { ...remote, ...incorrect }));
  }
});


function issueBatchFixture() {
  const state = extractManuscriptState(study());
  state.sections = [{ id: 'a', title: 'First', blocks: [] }, { id: 'b', title: 'Second', blocks: [] }];
  state.extensions = { ...state.extensions, 'org.openmanuscript.ojs.issue': {
    version: 1, installationId: 'installation-one', context: { externalId: '5' }, issue: { externalId: '7' },
    sections: [{ articles: [
      { rootSectionId: 'a', submissionExternalId: '12', publicationExternalId: '13' },
      { rootSectionId: 'b', submissionExternalId: '14', publicationExternalId: '15' },
    ] }],
  }};
  const source = { ...state, ...createInitialVersioningEnvelope(state, { summary: 'Issue batch', timestamp: state.updatedAt, completeness: 'complete' }) };
  const selections: IssueBatchSelection[] = [
    { rootSectionId: 'b', formats: ['html'], locale: 'hu', genreId: 2 },
    { rootSectionId: 'a', formats: ['pdf-print', 'html'], locale: 'hu', genreId: 2 },
  ];
  const requests: PublicationArtifactRequest[] = [];
  let workflowToken = 'a'.repeat(64);
  let liveLayout = 'layout';
  let failTransfer = 0;
  let writes = 0;
  const dependencies: IssueBatchDependencies = {
    source, layoutKey: 'layout', connectionId: 'connection-one',
    currentSource: () => source, currentLayoutKey: () => liveLayout, currentConnectionId: () => 'connection-one',
    send: async (_, request) => {
      requests.push(request);
      if (request.action === 'inspect') return { target: { ...target(), submissionId: request.submissionId,
        publicationId: request.publicationId!, issueId: 7, contextId: 5, installationId: 'installation-one', workflowToken } };
      if (++writes === failTransfer) throw Error('Synthetic uncertain network result');
      return { receipt: { ...receipt(request), issueId: 7, mediaType: request.mediaType.split(';')[0]! } };
    },
    prepare: async (item, formats) => formats.map(format => {
      const fileName = item.rootSectionId + (format === 'pdf-print' ? '.pdf' : '.html');
      const mediaType = format === 'pdf-print' ? 'application/pdf' : 'text/html;charset=utf-8';
      const bytes = new TextEncoder().encode(item.rootSectionId + ':' + format);
      const build = createPublicationBuildManifest({ manuscript: source, profile: resolvePublicationProfile(source), artifact: bytes,
        output: { format, fileName, mediaType }, generator: { applicationVersion: '1', renderer: 'fixture', rendererVersion: '1' } });
      return { format, mediaType, fileName, bytes, build, artifactBase64: 'not-trusted-by-batch' };
    }),
  };
  return { source, selections, requests, dependencies,
    changeToken: () => { workflowToken = 'b'.repeat(64); },
    changeLayout: () => { liveLayout = 'changed'; },
    failAt: (n: number) => { failTransfer = n; } };
}

test('issue batch prepares all selected outputs before writes and binds confirmed files to exact studies', async () => {
  const fixture = issueBatchFixture();
  const batch = await prepareOjsIssueBatch(fixture.dependencies, fixture.selections);
  assert.deepEqual(batch.files.map(f => [f.rootSectionId, f.format]), [['a','pdf-print'],['a','html'],['b','html']]);
  assert.equal(fixture.requests.length, 2);
  assert.ok(fixture.requests.every(r => r.action === 'inspect'));
  const result = await batch.execute(true);
  assert.equal(result.failed, undefined);
  assert.equal(result.receipts.length, 3);
  const writes = fixture.requests.filter(r => r.action === 'transfer');
  assert.deepEqual(writes.map(r => [r.submissionId, r.publicationId, r.expectedIssueId, r.expectedInstallationId]),
    [[12,13,7,'installation-one'],[12,13,7,'installation-one'],[14,15,7,'installation-one']]);
  assert.equal(atob(writes[0]!.artifactBase64), 'a:pdf-print');
  assert.equal(writes[0]!.expectedWorkflowToken, 'a'.repeat(64));
  await assert.rejects(batch.execute(true), /replay/);
});

test('a changed remote token, changed layout or incomplete local preparation prevents all writes', async () => {
  const remote = issueBatchFixture();
  const batch = await prepareOjsIssueBatch(remote.dependencies, remote.selections);
  remote.changeToken();
  await assert.rejects(batch.execute(true), /workflow changed/);
  assert.ok(remote.requests.every(r => r.action === 'inspect'));
  const local = issueBatchFixture();
  const next = await prepareOjsIssueBatch(local.dependencies, local.selections);
  local.changeLayout();
  await assert.rejects(next.execute(true), /changed/);
  assert.ok(local.requests.every(r => r.action === 'inspect'));
  const incomplete = issueBatchFixture();
  await assert.rejects(prepareOjsIssueBatch({ ...incomplete.dependencies, prepare: async () => [] }, incomplete.selections), /Incomplete/);
  assert.ok(incomplete.requests.every(r => r.action === 'inspect'));
});

test('uncertain issue transfer preserves confirmed receipts and does not send subsequent files', async () => {
  const fixture = issueBatchFixture();
  fixture.failAt(2);
  const batch = await prepareOjsIssueBatch(fixture.dependencies, fixture.selections);
  const result = await batch.execute(true);
  assert.equal(result.receipts.length, 1);
  assert.equal(result.failed?.file.rootSectionId, 'a');
  assert.equal(result.failed?.file.format, 'html');
  assert.equal(result.failed?.outcome, 'unconfirmed');
  assert.equal(fixture.requests.filter(r => r.action === 'transfer').length, 2);
  await assert.rejects(batch.execute(true), /replay/);
});
