import { Database, Download, Search, Settings2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import { stageAddBibliographicRecord } from '../app/citationActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getReferenceLookupCopy } from '../i18n/referenceLookup';
import {
  formatBibliographyEntry,
  getBibliographicIdentifier,
} from '../model/citations';
import {
  BIBLIOGRAPHIC_PROVIDERS,
  loadBibliographicLookupSettings,
  normalizeLookupDoi,
  saveBibliographicLookupSettings,
  searchBibliographicProviders,
  type BibliographicLookupCandidate,
  type BibliographicLookupIssue,
  type BibliographicLookupSettings,
  type BibliographicProviderId,
} from '../services/bibliographicLookup';
import type { OmiBibliographicRecord } from '../types/omi';

export function ReferenceLookupPanel() {
  const { locale } = useTranslation();
  const copy = getReferenceLookupCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState<BibliographicLookupSettings>(() =>
    loadBibliographicLookupSettings(),
  );
  const [results, setResults] = useState<BibliographicLookupCandidate[]>([]);
  const [issues, setIssues] = useState<BibliographicLookupIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const records = manuscript.bibliographicRecords ?? [];
  const providerCount = settings.enabledProviders.length;
  const canSearch = query.trim().length >= 2 && providerCount > 0 && !loading;
  const importedKeys = useMemo(
    () =>
      new Set(
        results
          .filter((candidate) => recordExists(records, candidate.record))
          .map((candidate) => candidate.key),
      ),
    [records, results],
  );

  function updateSettings(next: BibliographicLookupSettings): void {
    setSettings(next);
    saveBibliographicLookupSettings(next);
  }

  function toggleProvider(provider: BibliographicProviderId, enabled: boolean): void {
    const enabledProviders = enabled
      ? [...settings.enabledProviders, provider]
      : settings.enabledProviders.filter((candidate) => candidate !== provider);

    updateSettings({
      ...settings,
      enabledProviders: BIBLIOGRAPHIC_PROVIDERS.filter((candidate) =>
        enabledProviders.includes(candidate),
      ),
    });
  }

  async function runSearch(): Promise<void> {
    if (!canSearch) return;

    setLoading(true);
    setSearched(true);
    setIssues([]);

    try {
      const response = await searchBibliographicProviders(query, settings);
      setResults(response.candidates);
      setIssues(response.issues);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="omi-lookup-panel" aria-labelledby="omi-lookup-title">
      <div className="omi-lookup-heading">
        <div>
          <h4 id="omi-lookup-title">
            <Database size={17} aria-hidden="true" />
            {copy.title}
          </h4>
          <p>{copy.description}</p>
        </div>
      </div>

      <form
        className="omi-lookup-form"
        onSubmit={(event) => {
          event.preventDefault();
          void runSearch();
        }}
      >
        <div className="omi-lookup-query-row">
          <label className="omi-lookup-query">
            <Search size={16} aria-hidden="true" />
            <span className="sr-only">{copy.queryLabel}</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={copy.queryPlaceholder}
              autoComplete="off"
            />
          </label>
          <button
            type="submit"
            className="studio-menu-primary-action"
            disabled={!canSearch}
          >
            <Search size={16} aria-hidden="true" />
            {loading ? copy.searching : copy.search}
          </button>
        </div>

        <div className="omi-provider-toggle-list" aria-label={copy.providers}>
          {BIBLIOGRAPHIC_PROVIDERS.map((provider) => (
            <label className="omi-provider-toggle" key={provider}>
              <input
                type="checkbox"
                checked={settings.enabledProviders.includes(provider)}
                onChange={(event) => toggleProvider(provider, event.target.checked)}
              />
              <span>{providerLabel(provider)}</span>
              {provider === 'openalex' && !settings.openAlexApiKey?.trim() ? (
                <small>{copy.apiKeyRequired}</small>
              ) : null}
            </label>
          ))}
        </div>

        <details className="omi-lookup-settings">
          <summary>
            <Settings2 size={15} aria-hidden="true" />
            {copy.serviceSettings}
          </summary>
          <div className="omi-lookup-settings-grid">
            <label>
              <span>{copy.crossrefEmail}</span>
              <input
                type="email"
                value={settings.crossrefMailto ?? ''}
                placeholder="name@example.org"
                onChange={(event) =>
                  updateSettings({
                    ...settings,
                    crossrefMailto: event.target.value,
                  })
                }
              />
              <small>{copy.crossrefEmailHint}</small>
            </label>
            <label>
              <span>{copy.openAlexApiKey}</span>
              <input
                type="password"
                value={settings.openAlexApiKey ?? ''}
                autoComplete="off"
                onChange={(event) =>
                  updateSettings({
                    ...settings,
                    openAlexApiKey: event.target.value,
                  })
                }
              />
              <small>{copy.openAlexApiKeyHint}</small>
            </label>
          </div>
          <p className="omi-lookup-privacy-note">{copy.privacyNote}</p>
        </details>
      </form>

      {issues.length > 0 ? (
        <div className="omi-lookup-issues" role="status">
          {issues.map((issue) => (
            <p key={`${issue.provider}:${issue.code}`}>
              <strong>{providerLabel(issue.provider)}:</strong>{' '}
              {issue.code === 'missing-api-key'
                ? copy.missingApiKey
                : copy.providerUnavailable}
            </p>
          ))}
        </div>
      ) : null}

      {searched && !loading && results.length === 0 ? (
        <p className="omi-lookup-empty">{copy.noResults}</p>
      ) : null}

      {results.length > 0 ? (
        <ol className="omi-lookup-results">
          {results.map((candidate) => {
            const imported = importedKeys.has(candidate.key);
            const doi = getBibliographicIdentifier(candidate.record, 'doi');
            const mtmtId = getBibliographicIdentifier(candidate.record, 'mtmt');

            return (
              <li key={candidate.key} className="omi-lookup-result">
                <div className="omi-lookup-result-main">
                  <div className="omi-lookup-provider-badges">
                    {candidate.providers.map((provider) => (
                      <span key={provider}>{providerLabel(provider)}</span>
                    ))}
                  </div>
                  <strong>{candidate.record.title}</strong>
                  <p>{formatBibliographyEntry(candidate.record)}</p>
                  <div className="omi-lookup-result-meta">
                    <span>{candidate.record.type}</span>
                    {doi ? <code>DOI {doi}</code> : null}
                    {mtmtId ? <code>MTMT {mtmtId}</code> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className="studio-menu-secondary-action"
                  disabled={imported}
                  onClick={() => stageAddBibliographicRecord(candidate.record)}
                >
                  <Download size={15} aria-hidden="true" />
                  {imported ? copy.alreadyAdded : copy.addToLibrary}
                </button>
              </li>
            );
          })}
        </ol>
      ) : null}
    </section>
  );
}

function providerLabel(provider: BibliographicProviderId): string {
  switch (provider) {
    case 'crossref':
      return 'Crossref';
    case 'datacite':
      return 'DataCite';
    case 'openalex':
      return 'OpenAlex';
    case 'mtmt':
      return 'MTMT';
  }
}

function recordExists(
  records: OmiBibliographicRecord[],
  candidate: OmiBibliographicRecord,
): boolean {
  const candidateDoi = normalizeLookupDoi(
    getBibliographicIdentifier(candidate, 'doi') ?? '',
  );
  const candidateMtmt = getBibliographicIdentifier(candidate, 'mtmt');

  return records.some((record) => {
    const recordDoi = normalizeLookupDoi(
      getBibliographicIdentifier(record, 'doi') ?? '',
    );

    if (candidateDoi && recordDoi === candidateDoi) return true;
    if (
      candidateMtmt &&
      getBibliographicIdentifier(record, 'mtmt') === candidateMtmt
    ) {
      return true;
    }

    return (
      normalizeText(record.title) === normalizeText(candidate.title) &&
      normalizeText(record.issued ?? '') === normalizeText(candidate.issued ?? '')
    );
  });
}

function normalizeText(value: string): string {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
}
