import { isTauri } from '@tauri-apps/api/core';
import { getStudioApiBaseUrl } from '../../services/studioServer';
import type { HealthDiscipline } from './model';
export type HealthProvider = 'pubmed' | 'europe-pmc' | 'clinical-trials';
export interface HealthSearchRecord {
  id: string; provider: HealthProvider; title: string; authors: string[]; journal: string;
  year: string; doi: string; pmid: string; url: string; rights: string; status: string;
  kind: 'article' | 'preprint' | 'trial';
}
export interface HealthSearchPage { items: HealthSearchRecord[]; totalResults: number; nextCursor: string | null }
export const HEALTH_PROVIDERS = ['pubmed', 'europe-pmc', 'clinical-trials'] as const;
export const HEALTH_PROVIDER_NAMES = { pubmed: 'PubMed', 'europe-pmc': 'Europe PMC', 'clinical-trials': 'ClinicalTrials.gov' };
const hosts = { pubmed: 'pubmed.ncbi.nlm.nih.gov', 'europe-pmc': 'europepmc.org', 'clinical-trials': 'clinicaltrials.gov' };
export function isHealthSearchRecord(value: unknown, provider: HealthProvider): value is HealthSearchRecord {
  if (!value || typeof value !== 'object') return false;
  const v = value as HealthSearchRecord;
  if (v.provider !== provider || !['article', 'preprint', 'trial'].includes(v.kind) || !Array.isArray(v.authors) || !v.authors.every(a => typeof a === 'string')) return false;
  if (!['id', 'title', 'journal', 'year', 'doi', 'pmid', 'url', 'rights', 'status'].every(k => typeof (value as Record<string, unknown>)[k] === 'string')) return false;
  try { const url = new URL(v.url); return url.protocol === 'https:' && url.hostname === hosts[provider] && !url.username && !url.password && !url.port; } catch { return false; }
}
export async function searchHealthDatabase(discipline: HealthDiscipline, workspaceId: string, provider: HealthProvider, query: string, cursor?: string, signal?: AbortSignal): Promise<HealthSearchPage> {
  const headers = new Headers({ Accept: 'application/json', 'Content-Type': 'application/json' });
  if (isTauri()) {
    headers.set('X-OMI-Native-Client', '1');
    const token = globalThis.localStorage?.getItem('omi_native_session_token');
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  const url = `${getStudioApiBaseUrl()}/api/v1/modules/${discipline}/health/search?${new URLSearchParams({ workspaceId })}`;
  const response = await fetch(url, { method: 'POST', headers, credentials: 'include', body: JSON.stringify({ provider, query, ...(cursor ? { cursor } : {}) }), ...(signal ? { signal } : {}) });
  if (!response.ok) throw new Error('HEALTH_SEARCH_FAILED');
  const result: unknown = await response.json();
  if (!result || typeof result !== 'object') throw new Error('INVALID_HEALTH_SEARCH_RESPONSE');
  const page = result as HealthSearchPage;
  if (!Array.isArray(page.items) || !Number.isSafeInteger(page.totalResults) || page.totalResults < 0 || (page.nextCursor !== null && (typeof page.nextCursor !== 'string' || page.nextCursor.length > 1024))) throw new Error('INVALID_HEALTH_SEARCH_RESPONSE');
  return { ...page, items: page.items.filter(item => isHealthSearchRecord(item, provider)) };
}
