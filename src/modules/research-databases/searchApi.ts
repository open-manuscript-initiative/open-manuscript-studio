import { isTauri } from '@tauri-apps/api/core';
import { getStudioApiBaseUrl } from '../../services/studioServer';
export type ResearchDatabaseProvider = 'eric' | 'inspire-hep' | 'pubchem' | 'gbif';
export interface ResearchDatabaseRecord { id: string; provider: ResearchDatabaseProvider; title: string; authors: string[]; year: string; description: string; url: string; rights: string }
export interface ResearchDatabasePage { items: ResearchDatabaseRecord[]; totalResults: number; nextCursor: string | null }
export const PROVIDERS: ResearchDatabaseProvider[] = ['eric', 'inspire-hep', 'pubchem', 'gbif'];
export const PROVIDER_NAMES: Record<ResearchDatabaseProvider, string> = { eric: 'ERIC', 'inspire-hep': 'INSPIRE-HEP', pubchem: 'PubChem', gbif: 'GBIF' };
const hosts: Record<ResearchDatabaseProvider, string> = { eric: 'eric.ed.gov', 'inspire-hep': 'inspirehep.net', pubchem: 'pubchem.ncbi.nlm.nih.gov', gbif: 'www.gbif.org' };
export function isResearchDatabaseRecord(value: unknown, provider: ResearchDatabaseProvider): value is ResearchDatabaseRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as ResearchDatabaseRecord;
  if (v.provider !== provider || !Array.isArray(v.authors) || !v.authors.every(a => typeof a === 'string')) return false;
  if (!['id','title','year','description','url','rights'].every(k => typeof (value as Record<string, unknown>)[k] === 'string')) return false;
  try { const u = new URL(v.url); return u.protocol === 'https:' && u.hostname === hosts[provider] && !u.username && !u.password && !u.port; } catch { return false; }
}
export async function searchResearchDatabase(moduleId: 'social-research-methods' | 'experimental-laboratory', workspaceId: string, provider: ResearchDatabaseProvider, query: string, cursor?: string, signal?: AbortSignal): Promise<ResearchDatabasePage> {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  if (isTauri()) { headers.set('X-OMI-Native-Client', '1'); const token = globalThis.localStorage?.getItem('omi_native_session_token'); if (token) headers.set('Authorization', `Bearer ${token}`); }
  const url = `${getStudioApiBaseUrl()}/api/v1/modules/${moduleId}/research-databases/search?${new URLSearchParams({ workspaceId })}`;
  const response = await fetch(url, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ provider, query, ...(cursor ? { cursor } : {}) }), ...(signal ? { signal } : {}) });
  if (!response.ok) throw new Error('RESEARCH_DATABASE_SEARCH_FAILED');
  const result: unknown = await response.json(); if (!result || typeof result !== 'object') throw new Error('INVALID_RESEARCH_DATABASE_RESPONSE');
  const page = result as ResearchDatabasePage;
  if (!Array.isArray(page.items) || !Number.isSafeInteger(page.totalResults) || page.totalResults < 0 || (page.nextCursor !== null && typeof page.nextCursor !== 'string')) throw new Error('INVALID_RESEARCH_DATABASE_RESPONSE');
  return { ...page, items: page.items.filter(item => isResearchDatabaseRecord(item, provider)) };
}
