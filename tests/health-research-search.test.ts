import assert from 'node:assert/strict';
import test from 'node:test';
import { searchHealthResearch } from '../server/src/integrations/healthResearch/search.ts';
import { healthResultToReference, hasHealthReference, psychArchivesSearchUrl } from '../src/modules/health-research/searchReferences.ts';
import { isHealthSearchRecord } from '../src/modules/health-research/searchApi.ts';

const response = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });

test('PubMed sends an encoded query, maps summary metadata and limits pagination', async () => {
  const urls: URL[] = [];
  const result = await searchHealthResearch({ provider: 'pubmed', query: 'synthetic & trial', fetchImpl: async (input, options) => {
    const url = new URL(String(input)); urls.push(url);
    assert.equal(url.hostname, 'eutils.ncbi.nlm.nih.gov'); assert.equal(options?.redirect, 'error');
    return url.pathname.includes('esearch') ? response({ esearchresult: { count: '1', idlist: ['12345'] } }) : response({ result: { uids: ['12345'], '12345': { title: 'Synthetic article', authors: [{ name: 'Test A' }], fulljournalname: 'Synthetic journal', pubdate: '2026', articleids: [{ idtype: 'doi', value: '10.9999/synthetic' }] } } });
  } });
  assert.equal(urls[0].searchParams.get('term'), 'synthetic & trial');
  assert.equal(result.items[0].url, 'https://pubmed.ncbi.nlm.nih.gov/12345/');
  assert.equal(result.items[0].doi, '10.9999/synthetic'); assert.equal(result.nextCursor, null);
  await assert.rejects(searchHealthResearch({ provider: 'pubmed', query: 'test', cursor: '9999' }), /offset/);
});

test('Europe PMC preserves explicit licence without inferring one from open access and uses safe record links', async () => {
  const result = await searchHealthResearch({ provider: 'europe-pmc', query: 'synthetic', fetchImpl: async input => {
    const url = new URL(String(input)); assert.equal(url.searchParams.get('cursorMark'), '*');
    return response({ hitCount: 3, resultList: { result: [
      { id: '12345', source: 'MED', title: 'Synthetic article', doi: '10.9999/test', license: 'CC BY', authorList: { author: [{ fullName: 'Synthetic Author' }] } },
      { id: '12346', source: 'PPR', title: 'Synthetic preprint', isOpenAccess: 'Y', pubTypeList: { pubType: ['preprint'] } },
      { id: '../bad', source: 'MED', title: 'Unsafe record' },
    ] } });
  } });
  assert.equal(result.items.length, 2); assert.equal(result.items[0].rights, 'CC BY');
  assert.equal(result.items[1].rights, ''); assert.equal(result.items[1].kind, 'preprint');
  assert.equal(result.items[0].url, 'https://europepmc.org/article/MED/12345');
});

test('ClinicalTrials.gov uses v2 metadata and never maps trial registration to peer-review certification', async () => {
  const result = await searchHealthResearch({ provider: 'clinical-trials', query: 'synthetic', cursor: 'next-token', fetchImpl: async input => {
    const url = new URL(String(input)); assert.equal(url.pathname, '/api/v2/studies');
    assert.equal(url.searchParams.get('pageToken'), 'next-token'); assert.equal(url.searchParams.get('query.term'), 'synthetic');
    return response({ totalCount: 2, nextPageToken: 'next-page', studies: [{ protocolSection: {
      identificationModule: { nctId: 'NCT00000001', briefTitle: 'Synthetic trial' },
      statusModule: { overallStatus: 'COMPLETED', lastUpdatePostDateStruct: { date: '2026-01-01' } },
      sponsorCollaboratorsModule: { leadSponsor: { name: 'Synthetic institution' } },
    } }] });
  } });
  assert.equal(result.items[0].kind, 'trial'); assert.equal(result.items[0].status, 'COMPLETED');
  assert.equal(result.nextCursor, 'next-page'); const reference = healthResultToReference(result.items[0]);
  assert.equal(reference.status, 'provisional'); assert.equal(reference.type, 'web-page');
  assert.ok(reference.identifiers.some(i => i.scheme === 'nct')); assert.ok(hasHealthReference([reference], result.items[0]));
});

test('adapters reject malformed payloads, untrusted cursors, upstream errors and oversized bodies', async () => {
  await assert.rejects(searchHealthResearch({ provider: 'europe-pmc', query: 'test', cursor: 'https://evil.test' }), /cursor/);
  await assert.rejects(searchHealthResearch({ provider: 'europe-pmc', query: 'test', fetchImpl: async () => response({}) }), /Invalid/);
  await assert.rejects(searchHealthResearch({ provider: 'clinical-trials', query: 'test', fetchImpl: async () => new Response('', { status: 429 }) }), /failed/);
  await assert.rejects(searchHealthResearch({ provider: 'clinical-trials', query: 'test', fetchImpl: async () => new Response('x'.repeat(2_000_001)) }), /too large/);
});

test('client drops unsafe provider links and references deduplicate across providers by DOI', () => {
  const item = { id: '12345', provider: 'pubmed' as const, title: 'Synthetic', authors: ['Test'], journal: '', year: '', doi: '10.9999/Test', pmid: '12345', url: 'https://pubmed.ncbi.nlm.nih.gov/12345/', rights: '', status: '', kind: 'article' as const };
  assert.ok(isHealthSearchRecord(item, 'pubmed'));
  assert.equal(isHealthSearchRecord({ ...item, url: 'javascript:alert(1)' }, 'pubmed'), false);
  assert.equal(isHealthSearchRecord({ ...item, url: 'https://evil.test/' }, 'pubmed'), false);
  const reference = healthResultToReference(item);
  assert.ok(hasHealthReference([reference], { ...item, provider: 'europe-pmc', id: 'MED:12345' }));
  assert.equal(new URL(psychArchivesSearchUrl('synthetic & test')).searchParams.get('q'), 'synthetic & test');
});
