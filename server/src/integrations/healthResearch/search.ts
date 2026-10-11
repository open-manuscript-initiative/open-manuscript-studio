export type HealthProvider = 'pubmed' | 'europe-pmc' | 'clinical-trials';
export interface HealthSearchRecord {
  id: string; provider: HealthProvider; title: string; authors: string[]; journal: string;
  year: string; doi: string; pmid: string; url: string; rights: string; status: string;
  kind: 'article' | 'preprint' | 'trial';
}
export interface HealthSearchPage { items: HealthSearchRecord[]; totalResults: number; nextCursor: string | null }
const PAGE_SIZE = 12;
const MAX_BYTES = 2_000_000;
const text = (v: unknown, max = 1000): string => typeof v === 'string' ? v.trim().slice(0, max) : '';
const object = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const array = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const count = (v: unknown): number => Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0;

/** Fixed HTTPS endpoints, no redirects or caller-provided URLs; bound JSON bytes as well as request time. */
async function json(url: URL, fetchImpl: typeof fetch): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('Health research provider request failed.');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Provider response too large.');
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Provider response is empty.');
  let size = 0; const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.length;
      if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Provider response too large.'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider JSON.');
  return object(value);
}

// NCBI's keyless limit is 3 requests/sec. Serialize request starts for this process.
let ncbiQueue: Promise<void> = Promise.resolve();
let nextNcbiStart = 0;
let queuedNcbi = 0;
async function ncbiJson(url: URL, fetchImpl: typeof fetch): Promise<Record<string, unknown>> {
  if (queuedNcbi >= 12) throw new Error('PubMed search is busy.');
  queuedNcbi++;
  const turn = ncbiQueue.then(async () => {
    const delay = Math.max(0, nextNcbiStart - Date.now());
    if (delay) await new Promise(resolve => { setTimeout(resolve, delay); });
    nextNcbiStart = Date.now() + 350;
  });
  ncbiQueue = turn.catch(() => undefined);
  try { await turn; return await json(url, fetchImpl); } finally { queuedNcbi--; }
}
function baseRecord(provider: HealthProvider, id: string, title: string, url: string): HealthSearchRecord {
  return { provider, id, title, url, authors: [], journal: '', year: '', doi: '', pmid: '', rights: '', status: '', kind: 'article' };
}
function token(v: unknown): string | null {
  const s = text(v, 1025); return s && s.length <= 1024 && /^[A-Za-z0-9+/_=.-]+$/.test(s) ? s : null;
}
export async function searchHealthResearch({ provider, query, cursor, fetchImpl = fetch }: {
  provider: HealthProvider; query: string; cursor?: string | undefined; fetchImpl?: typeof fetch;
}): Promise<HealthSearchPage> {
  if (!['pubmed', 'europe-pmc', 'clinical-trials'].includes(provider) || query.trim().length < 2 || query.length > 240) throw new Error('Invalid health research query.');
  if (cursor && !token(cursor)) throw new Error('Invalid health research cursor.');
  if (provider === 'pubmed') {
    const offset = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 9988) throw new Error('Invalid PubMed offset.');
    const url = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi');
    url.search = new URLSearchParams({ db: 'pubmed', term: query, retmode: 'json', retmax: String(PAGE_SIZE), retstart: String(offset), tool: 'OMIStudio' }).toString();
    const data = object((await ncbiJson(url, fetchImpl)).esearchresult);
    if (!Array.isArray(data.idlist) || data.count === undefined) throw new Error('Invalid PubMed search response.');
    const ids = data.idlist.filter((id): id is string => typeof id === 'string' && /^\d{1,12}$/.test(id)).slice(0, PAGE_SIZE);
    if (!ids.length) return { items: [], totalResults: count(data.count), nextCursor: null };
    const detailsUrl = new URL('https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi');
    detailsUrl.search = new URLSearchParams({ db: 'pubmed', id: ids.join(','), retmode: 'json', tool: 'OMIStudio' }).toString();
    const details = object((await ncbiJson(detailsUrl, fetchImpl)).result);
    if (!Array.isArray(details.uids)) throw new Error('Invalid PubMed summary response.');
    const items = ids.flatMap(id => {
      const record = object(details[id]); const title = text(record.title);
      if (!title) return [];
      const result = baseRecord(provider, id, title, `https://pubmed.ncbi.nlm.nih.gov/${id}/`);
      result.authors = array(record.authors).map(a => text(object(a).name, 200)).filter(Boolean).slice(0, 100);
      result.journal = text(record.fulljournalname); result.year = text(record.pubdate, 100); result.pmid = id;
      result.doi = text(object(array(record.articleids).find(a => object(a).idtype === 'doi')).value, 200);
      if (array(record.pubtype).some(type => typeof type === 'string' && /preprint/i.test(type))) result.kind = 'preprint';
      return [result];
    });
    const next = offset + ids.length;
    return { items, totalResults: count(data.count), nextCursor: ids.length === PAGE_SIZE && next < count(data.count) && next <= 9988 ? String(next) : null };
  }
  if (provider === 'europe-pmc') {
    const url = new URL('https://www.ebi.ac.uk/europepmc/webservices/rest/search');
    url.search = new URLSearchParams({ query, format: 'json', resultType: 'core', pageSize: String(PAGE_SIZE), cursorMark: cursor || '*' }).toString();
    const data = await json(url, fetchImpl); const results = object(data.resultList).result;
    if (!Array.isArray(results) || data.hitCount === undefined) throw new Error('Invalid Europe PMC response.');
    const items = results.slice(0, PAGE_SIZE).flatMap(raw => {
      const r = object(raw); const id = text(r.id, 80); const source = text(r.source, 20); const title = text(r.title);
      if (!title || !/^[A-Za-z0-9.-]+$/.test(id) || !/^[A-Z]+$/.test(source)) return [];
      const result = baseRecord(provider, `${source}:${id}`, title, `https://europepmc.org/article/${source}/${id}`);
      result.authors = array(object(r.authorList).author).map(a => text(object(a).fullName, 200)).filter(Boolean).slice(0, 100);
      result.journal = text(object(object(r.journalInfo).journal).title); result.year = text(r.pubYear, 100);
      result.doi = text(r.doi, 200); result.pmid = text(r.pmid, 20); result.rights = text(r.license, 200);
      if (source === 'PPR' || array(object(r.pubTypeList).pubType).some(type => typeof type === 'string' && /preprint/i.test(type))) result.kind = 'preprint';
      return [result];
    });
    const next = token(data.nextCursorMark);
    return { items, totalResults: count(data.hitCount), nextCursor: results.length === PAGE_SIZE && next !== cursor ? next : null };
  }
  const url = new URL('https://clinicaltrials.gov/api/v2/studies');
  url.search = new URLSearchParams({ 'query.term': query, format: 'json', pageSize: String(PAGE_SIZE), countTotal: 'true', fields: 'NCTId,BriefTitle,OverallStatus,LeadSponsorName,LastUpdatePostDate' }).toString();
  if (cursor) url.searchParams.set('pageToken', cursor);
  const data = await json(url, fetchImpl);
  if (!Array.isArray(data.studies)) throw new Error('Invalid ClinicalTrials.gov response.');
  const items = data.studies.slice(0, PAGE_SIZE).flatMap(raw => {
    const p = object(object(raw).protocolSection); const identification = object(p.identificationModule);
    const id = text(identification.nctId, 20); const title = text(identification.briefTitle);
    if (!/^NCT\d{8}$/.test(id) || !title) return [];
    const result = baseRecord(provider, id, title, `https://clinicaltrials.gov/study/${id}`);
    result.kind = 'trial'; result.status = text(object(p.statusModule).overallStatus, 100);
    result.year = text(object(object(p.statusModule).lastUpdatePostDateStruct).date, 100);
    const sponsor = text(object(object(p.sponsorCollaboratorsModule).leadSponsor).name, 200);
    if (sponsor) result.authors = [sponsor];
    return [result];
  });
  return { items, totalResults: count(data.totalCount), nextCursor: token(data.nextPageToken) };
}
