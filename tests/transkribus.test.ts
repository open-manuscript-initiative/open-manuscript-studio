import assert from 'node:assert/strict';
import { before, test } from 'node:test';
import { createTranskribusClient, normalizeTranskribusJob, validateTranskribusImage, TRANSKRIBUS_MAX_IMAGE_BYTES } from '../server/src/integrations/transkribus/client.ts';
import type { TranskribusModel } from '../src/modules/transkribus/api.ts';
import { filterTranskribusModels } from '../src/modules/transkribus/modelCatalog.ts';
import { buildTranskribusImport, transkribusStorageKey, type SavedTranskribusJob } from '../src/modules/transkribus/model.ts';
import { getTranskribusCopy } from '../src/modules/transkribus/copy.ts';
import { appendTranskribusHelp } from '../src/i18n/helpTranskribus.ts';
import { loadPrimaryLocaleDictionariesForTest } from './test-primary-locale-dictionaries.ts';
import { stageInsertBlocks } from '../src/app/visualBlockActions.ts';
import { useStudioStore } from '../src/app/useStudioStore.ts';
import { createVersionedTestManuscript } from './testManuscriptFixture.ts';
import { parseOmiJson, toPortableOmiManuscript } from '../src/services/omiPortableFormat.ts';

const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j1ioAAAAASUVORK5CYII=';
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const fixture = (): SavedTranskribusJob => ({ version: 1, job: { processId: 42, status: 'FINISHED', text: 'original', handle: `42.${'a'.repeat(43)}` },
  modelId: 38230, fileName: 'page.png', title: 'Page', source: 'Archive A, MS 12, fol. 4r', text: '<script>literal source</script>\nárvíztűrő tükörfúrógép', rights: 'unknown' });

before(loadPrimaryLocaleDictionariesForTest);

test('model search matches names, localized languages, centuries and material without accents', () => {
  const models: TranskribusModel[] = [
    { modelId: 38230, name: 'Árvíz manuscripts', languages: ['lat', 'hun'], centuries: [16, 17],
      material: 'handwritten', creator: 'Synthetic archive', scripts: ['latin'] },
    { modelId: 2, name: 'Latin print', languages: ['lat'], centuries: [15],
      material: 'print', creator: '', scripts: [] },
  ];
  const search = (query: string, language = '', material = '') => filterTranskribusModels(models, { query, language, material }, 'hu');
  assert.deepEqual(search('arviz').map(model => model.modelId), [38230]);
  assert.deepEqual(search('magyar 17').map(model => model.modelId), [38230]);
  assert.deepEqual(search('latin', 'lat', 'print').map(model => model.modelId), [2]);
  assert.equal(search('no such model').length, 0);
});

test('Transkribus uses the documented OIDC client, password exchange and rotating refresh tokens', async () => {
  const forms: URLSearchParams[] = [];
  const client = createTranskribusClient({ fetchImpl: async (input, init) => {
    assert.equal(String(input), 'https://account.readcoop.eu/auth/realms/readcoop/protocol/openid-connect/token');
    assert.equal(init?.redirect, 'error');
    forms.push(init?.body as URLSearchParams);
    return json({ access_token: 'synthetic-access', refresh_token: 'synthetic-refresh', expires_in: 300 });
  } });
  const tokens = await client.login('person@example.test', 'synthetic-password');
  assert.equal(forms[0].get('client_id'), 'processing-api-client');
  assert.equal(forms[0].get('grant_type'), 'password');
  assert.equal(forms[0].get('password'), 'synthetic-password');
  assert.ok(tokens.expiresAt > Date.now());
  await client.refresh(tokens.refreshToken);
  assert.equal(forms[1].get('grant_type'), 'refresh_token');
  assert.equal(forms[1].get('refresh_token'), 'synthetic-refresh');
});

test('API origins only select fixed production and staging endpoints', async () => {
  for (const [apiOrigin, expectedOrigin] of [
    [undefined, 'https://api.transkribus.org'],
    ['https://api.transkribus.org', 'https://api.transkribus.org'],
    ['https://api-staging.transkribus.org', 'https://api-staging.transkribus.org'],
  ] as const) {
    const paths: string[] = [];
    const client = createTranskribusClient({ apiOrigin, fetchImpl: async (input, init) => {
      paths.push(String(input));
      assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-access');
      assert.equal(init?.redirect, 'error');
      return String(input).endsWith('/page')
        ? new Response('<PcGts/>') : json({ processId: 42, status: 'FINISHED' });
    } });
    await client.submit('synthetic-access', 38230, png);
    await client.getJob('synthetic-access', 42);
    await client.getPageXml('synthetic-access', 42);
    assert.deepEqual(paths, [
      `${expectedOrigin}/v2/processes`,
      `${expectedOrigin}/v2/processes/42`,
      `${expectedOrigin}/v2/processes/42/page`,
    ]);
  }

  let calls = 0;
  const fetchImpl: typeof fetch = async () => { calls++; return json({}); };
  for (const apiOrigin of [
    '', 'http://127.0.0.1', 'http://api.transkribus.org',
    'https://evil.test/https://api.transkribus.org',
    'https://api.transkribus.org.evil.test',
    'https://api.transkribus.org@evil.test',
    'https://api.transkribus.org:8443',
    'https://api.transkribus.org/',
    'https://api.transkribus.org?next=https://evil.test',
    'https://api.transkribus.org#https://evil.test',
    'https://api-staging.transkribus.org.evil.test',
    'https://api-staging.transkribus.org@evil.test',
  ]) {
    assert.throws(() => createTranskribusClient({ apiOrigin, fetchImpl }), /Unsupported Transkribus API origin/);
  }
  assert.equal(calls, 0, 'unsupported origins must fail before any token-bearing request');
});

test('one image submission sends the exact v2 schema once without trusting response links', async () => {
  let calls = 0;
  const client = createTranskribusClient({ fetchImpl: async (input, init) => {
    calls++;
    assert.equal(String(input), 'https://api.transkribus.org/v2/processes');
    assert.equal(init?.method, 'POST');
    assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer synthetic-access');
    assert.equal(init?.redirect, 'error');
    assert.deepEqual(JSON.parse(String(init?.body)), { config: { textRecognition: { htrId: 38230 } }, image: { base64: png } });
    return json({ processId: 42, status: 'CREATED', links: [{ rel: 'status', href: 'https://evil.test/collect-token' }] });
  } });
  assert.deepEqual(await client.submit('synthetic-access', 38230, png), { processId: 42, status: 'CREATED', text: '' });
  assert.equal(calls, 1);
  const failing = createTranskribusClient({ fetchImpl: async () => { calls++; throw new Error('synthetic-private-body'); } });
  await assert.rejects(failing.submit('synthetic-access', 38230, png), { message: 'TRANSKRIBUS_UNAVAILABLE' });
  assert.equal(calls, 2, 'an uncertain paid submission must never be retried automatically');
});

test('invalid and oversized images and model IDs are rejected before any paid request', async () => {
  let calls = 0;
  const client = createTranskribusClient({ fetchImpl: async () => { calls++; return json({}); } });
  for (const image of ['', 'data:image/png;base64,' + png, Buffer.from('a PDF is not an image').toString('base64'), '!!!!']) {
    await assert.rejects(client.submit('synthetic-access', 1, image), /TRANSKRIBUS_INVALID_IMAGE/);
  }
  await assert.rejects(client.submit('synthetic-access', 0, png), /TRANSKRIBUS_INVALID_REQUEST/);
  const largest = Buffer.alloc(TRANSKRIBUS_MAX_IMAGE_BYTES);
  Buffer.from(png, 'base64').subarray(0, 8).copy(largest);
  validateTranskribusImage(largest.toString('base64'));
  assert.throws(() => validateTranskribusImage(Buffer.concat([largest, Buffer.from([1])]).toString('base64')), /INVALID_IMAGE/);
  assert.equal(calls, 0);
});

test('transcription preserves line order and Unicode without duplicating words or aggregate text', () => {
  const content = { regions: [{ lines: [{ text: 'Első sor', words: [{ text: 'duplicate' }] }, { words: [{ text: 'második' }, { text: 'sor' }] }] }, { lines: [{ text: 'Latin: æ, œ' }] }] };
  assert.equal(normalizeTranskribusJob({ processId: 1, status: 'FINISHED', content }).text, 'Első sor\nmásodik sor\n\nLatin: æ, œ');
  assert.equal(normalizeTranskribusJob({ processId: 1, status: 'FINISHED', content: { ...content, text: 'Canonical\naggregate' } }).text, 'Canonical\naggregate');
  for (const status of ['FAILED', 'CANCELLED', 'WAITING', 'RUNNING']) {
    assert.equal(normalizeTranskribusJob({ processId: 1, status }).status, status);
  }
  assert.throws(() => normalizeTranskribusJob({ processId: 1, status: 'UNKNOWN' }), /INVALID_RESPONSE/);
});

test('status and PAGE XML use fixed trusted URLs, reject mismatched IDs and bound response size', async () => {
  const paths: string[] = [];
  const client = createTranskribusClient({ fetchImpl: async input => {
    paths.push(String(input));
    return String(input).endsWith('/page') ? new Response('<PcGts/>') : json({ processId: 42, status: 'FINISHED', content: { text: 'Text' } });
  } });
  assert.equal((await client.getJob('token', 42)).text, 'Text');
  assert.equal(await client.getPageXml('token', 42), '<PcGts/>');
  assert.deepEqual(paths, ['https://api.transkribus.org/v2/processes/42', 'https://api.transkribus.org/v2/processes/42/page']);
  await assert.rejects(client.getJob('token', 43), /INVALID_RESPONSE/);
  const oversized = createTranskribusClient({ fetchImpl: async () => new Response('x'.repeat(6 * 1024 * 1024 + 1)) });
  await assert.rejects(oversized.getJob('token', 1), /RESULT_TOO_LARGE/);
  for (const [status, code] of [[401, 'RECONNECT'], [403, 'ACCESS_REQUIRED'], [429, 'LIMIT'], [404, 'NOT_FOUND']] as const) {
    const errors = createTranskribusClient({ fetchImpl: async () => new Response('synthetic-password', { status }) });
    await assert.rejects(errors.getJob('token', 1), new RegExp(`TRANSKRIBUS_${code}`));
  }
});

test('reviewed import appends safe plain text, source relationships and non-secret provenance through save/reopen', () => {
  const previous = useStudioStore.getState();
  try {
    const manuscript = createVersionedTestManuscript();
    const section = manuscript.sections[0];
    const initialCount = section.blocks.length;
    useStudioStore.setState({ manuscript, pendingChangeSet: null });
    const imported = buildTranskribusImport({ ...fixture(), modelName: 'Latin and Hungarian manuscripts' }, 'Forrás', new Date().toISOString());
    assert.equal(imported.bibliographicRecords[0].title, fixture().source);
    assert.equal(imported.sourceAttributions[0].predicate, 'prov:wasDerivedFrom');
    assert.equal(imported.sourceAttributions[0].assertionStatus, 'author-confirmed');
    const parsed = JSON.parse(imported.blocks[0].content!);
    assert.deepEqual(parsed.content[0].content[0], { type: 'text', text: '<script>literal source</script>' });
    assert.equal(JSON.stringify(imported).includes(fixture().job.handle), false, 'job authorization handles are not manuscript data');
    assert.equal(stageInsertBlocks(section.id, initialCount, imported.blocks, 'Transkribus import', imported.annotations, imported.sourceAttributions, imported.bibliographicRecords), true);
    useStudioStore.getState().checkpoint();
    const reopened = parseOmiJson(JSON.stringify(toPortableOmiManuscript(useStudioStore.getState().manuscript)));
    assert.equal(reopened.sections[0].blocks.length, initialCount + 2);
    assert.equal(reopened.sourceAttributions?.[0].targetBibliographicRecordId, imported.bibliographicRecords[0].id);
    assert.ok(reopened.annotations.some(note => note.targetText === 'omi:transkribus-transcription'));
    const provenance = reopened.annotations.find(note => note.targetText === 'omi:transkribus-transcription');
    assert.equal(JSON.parse(provenance!.body).modelName, 'Latin and Hungarian manuscripts');
  } finally { useStudioStore.setState(previous); }
});

test('self-authored sources keep hidden origin while third-party sources and completed jobs are required', () => {
  const input = fixture();
  assert.throws(() => buildTranskribusImport({ ...input, source: '' }, 'Source', ''), /required/);
  assert.throws(() => buildTranskribusImport({ ...input, job: { ...input.job, status: 'RUNNING' } }, 'Source', ''), /required/);
  const own = buildTranskribusImport({ ...input, source: '', rights: 'self-authored' }, 'Source', new Date().toISOString());
  assert.equal(own.blocks.length, 1);
  assert.equal(own.bibliographicRecords.length, 0);
  assert.ok(own.annotations.some(note => note.body === 'author-declared:self-authored-outside-omi'));
  const first = buildTranskribusImport(input, 'Source', new Date().toISOString());
  const repeated = buildTranskribusImport(input, 'Source', new Date().toISOString(), undefined, first.bibliographicRecords);
  assert.equal(repeated.bibliographicRecords.length, 0);
  assert.equal(repeated.sourceAttributions[0].targetBibliographicRecordId, first.bibliographicRecords[0].id);
  assert.notEqual(transkribusStorageKey('user:a', 'b'), transkribusStorageKey('user', 'a:b'));
});

test('Transkribus UI, errors and help are PO-backed in English, Hungarian and German', () => {
  for (const locale of ['en', 'hu', 'de']) {
    const copy = getTranskribusCopy(locale);
    assert.ok(copy.loginHint.trim());
    assert.ok(copy.modelSearch.trim());
    assert.ok(copy.chooseModel.trim());
    assert.ok(copy.errors.TRANSKRIBUS_MODELS_UNAVAILABLE.trim());
    assert.ok(copy.errors.TRANSKRIBUS_RECONNECT.trim());
    assert.ok(copy.rightsOptions['self-authored'].trim());
    const base = { navigation: '', title: '', description: '', gettingStarted: '', topics: [] };
    const help = appendTranskribusHelp(locale, base);
    assert.equal(help.topics[0].title, copy.helpTitle);
    assert.equal(appendTranskribusHelp(locale, help).topics.length, 1);
  }
  assert.equal(getTranskribusCopy('hu-HU').source, 'Forrás');
  assert.equal(getTranskribusCopy('de').source, 'Quelle');
  assert.equal(getTranskribusCopy('fr').source, 'Source');
});
