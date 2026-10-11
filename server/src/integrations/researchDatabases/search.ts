export type ResearchDatabaseProvider = 'eric' | 'inspire-hep' | 'pubchem' | 'gbif';
export interface ResearchDatabaseRecord {
  id: string; provider: ResearchDatabaseProvider; title: string; authors: string[];
  year: string; description: string; url: string; rights: string;
}
export interface ResearchDatabasePage { items: ResearchDatabaseRecord[]; totalResults: number; nextCursor: string | null }
const PAGE_SIZE = 10;
const MAX_BYTES = 1_500_000;
const text = (v: unknown, max = 1000): string => typeof v === 'string' ? v.trim().slice(0, max) : '';
const obj = (v: unknown): Record<string, unknown> => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const count = (v: unknown): number => Number.isSafeInteger(Number(v)) && Number(v) >= 0 ? Number(v) : 0;
async function json(url: URL, fetchImpl: typeof fetch): Promise<Record<string, unknown>> {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw new Error('Research database request failed.');
  if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('Provider response too large.');
  const reader = response.body?.getReader(); if (!reader) throw new Error('Provider response is empty.');
  let size = 0; const chunks: Uint8Array[] = [];
  try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.length; if (size > MAX_BYTES) { await reader.cancel(); throw new Error('Provider response too large.'); } chunks.push(part.value); } }
  finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid provider JSON.');
  return obj(value);
}
function cursorOffset(cursor?: string): number {
  if (!cursor) return 0;
  if (!/^\d{1,6}$/.test(cursor)) throw new Error('Invalid research database cursor.');
  const value = Number(cursor); if (value > 100_000) throw new Error('Research database cursor is out of range.');
  return value;
}
function record(provider: ResearchDatabaseProvider, id: string, title: string, url: string): ResearchDatabaseRecord {
  return { id, provider, title, url, authors: [], year: '', description: '', rights: '' };
}
export async function searchResearchDatabase({ provider, query, cursor, fetchImpl = fetch }: {
  provider: ResearchDatabaseProvider; query: string; cursor?: string; fetchImpl?: typeof fetch;
}): Promise<ResearchDatabasePage> {
  if (!['eric', 'inspire-hep', 'pubchem', 'gbif'].includes(provider) || query.trim().length < 2 || query.length > 240) throw new Error('Invalid research database query.');
  const offset = cursorOffset(cursor);
  if (provider === 'eric') {
    const url = new URL('https://api.ies.ed.gov/eric/');
    url.search = new URLSearchParams({ search: query, format: 'json', rows: String(PAGE_SIZE), start: String(offset) }).toString();
    const data = await json(url, fetchImpl); const docs = arr(data.response && obj(data.response).docs);
    const total = count(obj(data.response).numFound ?? data.numFound);
    const items = docs.slice(0, PAGE_SIZE).flatMap(raw => {
      const r = obj(raw); const id = text(r.id, 120); const title = text(r.title);
      if (!title || !/^[A-Za-z0-9._:-]+$/.test(id)) return [];
      const item = record(provider, id, title, `https://eric.ed.gov/?id=${encodeURIComponent(id)}`);
      item.authors = arr(r.author).map(a => text(a, 200)).filter(Boolean).slice(0, 20);
      item.year = text(r.publicationdateyear, 20); item.description = text(r.description, 700);
      item.rights = text(r.fulltext, 200);
      return [item];
    });
    const next = offset + docs.length;
    return { items, totalResults: total, nextCursor: docs.length === PAGE_SIZE && next < total && next <= 100_000 ? String(next) : null };
  }
  if (provider === 'inspire-hep') {
    const url = new URL('https://inspirehep.net/api/literature');
    url.search = new URLSearchParams({ q: query, size: String(PAGE_SIZE), page: String(Math.floor(offset / PAGE_SIZE)) }).toString();
    const data = await json(url, fetchImpl); const hits = obj(data.hits); const rows = arr(hits.hits);
    const total = count(obj(hits.total).value);
    const items = rows.slice(0, PAGE_SIZE).flatMap(raw => {
      const meta = obj(obj(raw).metadata); const id = text(obj(raw).id, 120); const title = text(obj(arr(meta.titles)[0]).title);
      if (!id || !title || !/^[A-Za-z0-9._:-]+$/.test(id)) return [];
      const item = record(provider, id, title, `https://inspirehep.net/literature/${encodeURIComponent(id)}`);
      item.authors = arr(meta.authors).map(a => text(obj(obj(a).full_name).value ?? obj(a).full_name, 200)).filter(Boolean).slice(0, 30);
      item.year = text(arr(meta.publication_info).map(p => obj(p).year).find(Boolean), 20);
      item.description = text(meta.abstract, 700);
      return [item];
    });
    const next = offset + rows.length;
    return { items, totalResults: total, nextCursor: rows.length === PAGE_SIZE && next < total && next <= 100_000 ? String(next) : null };
  }
  if (provider === 'pubchem') {
    const page = Math.floor(offset / PAGE_SIZE);
    const names = new URL(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(query)}/cids/JSON`);
    const found = await json(names, fetchImpl); const cids = arr(obj(found.IdentifierList).CID).map(v => String(v)).filter(v => /^\d{1,12}$/.test(v));
    const selected = cids.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
    if (!selected.length) return { items: [], totalResults: cids.length, nextCursor: null };
    const properties = new URL(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${selected.join(',')}/property/Title,MolecularFormula,MolecularWeight/JSON`);
    const data = await json(properties, fetchImpl); const props = arr(obj(data.PropertyTable).Properties);
    const items = props.flatMap(raw => {
      const p = obj(raw); const id = String(p.CID ?? ''); const title = text(p.Title, 300) || `CID ${id}`;
      if (!/^\d{1,12}$/.test(id)) return [];
      const item = record(provider, id, title, `https://pubchem.ncbi.nlm.nih.gov/compound/${id}`);
      item.description = [text(p.MolecularFormula, 80), text(p.MolecularWeight, 40) ? `Molecular weight: ${text(p.MolecularWeight, 40)}` : ''].filter(Boolean).join(' · ');
      return [item];
    });
    const next = (page + 1) * PAGE_SIZE;
    return { items, totalResults: cids.length, nextCursor: selected.length === PAGE_SIZE && next < cids.length && next <= 100_000 ? String(next) : null };
  }
  const url = new URL('https://api.gbif.org/v1/occurrence/search');
  url.search = new URLSearchParams({ q: query, limit: String(PAGE_SIZE), offset: String(offset) }).toString();
  const data = await json(url, fetchImpl); const rows = arr(data.results); const total = count(data.count);
  const items = rows.slice(0, PAGE_SIZE).flatMap(raw => {
    const r = obj(raw); const id = String(r.key ?? ''); const title = text(r.scientificName, 300) || text(r.verbatimScientificName, 300);
    if (!/^\d{1,16}$/.test(id) || !title) return [];
    const item = record(provider, id, title, `https://www.gbif.org/occurrence/${id}`);
    item.year = text(r.eventDate, 30); item.description = [text(r.country, 100), text(r.basisOfRecord, 100), r.decimalLatitude && r.decimalLongitude ? `${r.decimalLatitude}, ${r.decimalLongitude}` : ''].filter(Boolean).join(' · ');
    item.rights = text(r.license, 120);
    return [item];
  });
  const next = offset + rows.length;
  return { items, totalResults: total, nextCursor: rows.length === PAGE_SIZE && next < total && next <= 100_000 ? String(next) : null };
}
