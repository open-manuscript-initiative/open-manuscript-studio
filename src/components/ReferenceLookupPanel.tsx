import {
  Database,
  Download,
  LogIn,
  LogOut,
  Plus,
  Search,
  Settings2,
  Trash2,
} from 'lucide-react';
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
import {
  ACADEMIA_WEB_PROVIDER,
  clearWebBibliographicSession,
  createWebBibliographicProvider,
  loadWebBibliographicProviders,
  openWebBibliographicLogin,
  openWebBibliographicSearch,
  saveWebBibliographicProviders,
  validateWebBibliographicProviderDraft,
  type WebBibliographicProvider,
  type WebBibliographicProviderDraft,
} from '../services/webBibliographicProviders';
import type { OmiBibliographicRecord } from '../types/omi';

const EMPTY_WEB_PROVIDER_DRAFT: WebBibliographicProviderDraft = {
  name: '',
  loginUrl: '',
  searchUrlTemplate: '',
  logoutUrl: '',
};

export function ReferenceLookupPanel() {
  const { locale } = useTranslation();
  const copy = getReferenceLookupCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const [query, setQuery] = useState('');
  const [settings, setSettings] = useState<BibliographicLookupSettings>(() =>
    loadBibliographicLookupSettings(),
  );
  const [webProviders, setWebProviders] = useState<WebBibliographicProvider[]>(() =>
    loadWebBibliographicProviders(),
  );
  const [showCustomProvider, setShowCustomProvider] = useState(false);
  const [providerDraft, setProviderDraft] = useState<WebBibliographicProviderDraft>(
    EMPTY_WEB_PROVIDER_DRAFT,
  );
  const [webNotice, setWebNotice] = useState<{
    kind: 'info' | 'error';
    text: string;
  } | null>(null);
  const [results, setResults] = useState<BibliographicLookupCandidate[]>([]);
  const [issues, setIssues] = useState<BibliographicLookupIssue[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const records = manuscript.bibliographicRecords ?? [];
  const providerCount = settings.enabledProviders.length;
  const enabledWebProviders = webProviders.filter((provider) => provider.enabled);
  const canSearch =
    query.trim().length >= 2 &&
    providerCount + enabledWebProviders.length > 0 &&
    !loading;
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

  function updateWebProviders(next: WebBibliographicProvider[]): void {
    setWebProviders(next);
    saveWebBibliographicProviders(next);
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

  function toggleWebProvider(providerId: string, enabled: boolean): void {
    updateWebProviders(
      webProviders.map((provider) =>
        provider.id === providerId ? { ...provider, enabled } : provider,
      ),
    );
  }

  function addAcademiaProvider(): void {
    const existing = webProviders.find(
      (provider) => provider.id === ACADEMIA_WEB_PROVIDER.id,
    );

    if (existing) {
      updateWebProviders(
        webProviders.map((provider) =>
          provider.id === existing.id ? { ...provider, enabled: true } : provider,
        ),
      );
    } else {
      updateWebProviders([...webProviders, { ...ACADEMIA_WEB_PROVIDER }]);
    }

    setWebNotice({ kind: 'info', text: copy.webProviderAdded });
  }

  function addCustomProvider(): void {
    if (validateWebBibliographicProviderDraft(providerDraft)) {
      setWebNotice({ kind: 'error', text: copy.webProviderInvalid });
      return;
    }

    const provider = createWebBibliographicProvider(
      providerDraft,
      webProviders.map((candidate) => candidate.id),
    );
    updateWebProviders([...webProviders, provider]);
    setProviderDraft(EMPTY_WEB_PROVIDER_DRAFT);
    setShowCustomProvider(false);
    setWebNotice({ kind: 'info', text: copy.webProviderAdded });
  }

  async function openProviderLogin(
    provider: WebBibliographicProvider,
  ): Promise<void> {
    try {
      await openWebBibliographicLogin(provider);
      setWebNotice({ kind: 'info', text: copy.webLoginOpened });
    } catch {
      setWebNotice({ kind: 'error', text: copy.webProviderOpenFailed });
    }
  }

  async function searchWebProvider(
    provider: WebBibliographicProvider,
  ): Promise<void> {
    if (query.trim().length < 2) return;

    try {
      await openWebBibliographicSearch(provider, query);
      setWebNotice({ kind: 'info', text: copy.webSearchOpened });
    } catch {
      setWebNotice({ kind: 'error', text: copy.webProviderOpenFailed });
    }
  }

  async function signOutWebProvider(
    provider: WebBibliographicProvider,
  ): Promise<void> {
    try {
      const result = await clearWebBibliographicSession(provider);
      setWebNotice({
        kind: 'info',
        text: result.cleared
          ? copy.webSessionCleared
          : provider.logoutUrl
            ? copy.browserLogoutOpened
            : copy.webSessionPrivacyNote,
      });
    } catch {
      setWebNotice({ kind: 'error', text: copy.webProviderOpenFailed });
    }
  }

  async function removeWebProvider(
    provider: WebBibliographicProvider,
  ): Promise<void> {
    try {
      await clearWebBibliographicSession(provider);
      updateWebProviders(
        webProviders.filter((candidate) => candidate.id !== provider.id),
      );
      setWebNotice({ kind: 'info', text: copy.webProviderRemoved });
    } catch {
      setWebNotice({ kind: 'error', text: copy.webProviderOpenFailed });
    }
  }

  async function runSearch(): Promise<void> {
    if (!canSearch) return;

    setLoading(true);
    setSearched(true);
    setIssues([]);
    setWebNotice(null);

    const webSearchTasks = enabledWebProviders.map((provider) =>
      openWebBibliographicSearch(provider, query),
    );

    try {
      const apiSearch =
        providerCount > 0
          ? searchBibliographicProviders(query, settings)
          : Promise.resolve({ candidates: [], issues: [] });
      const [response, webSearchResults] = await Promise.all([
        apiSearch,
        Promise.allSettled(webSearchTasks),
      ]);

      setResults(response.candidates);
      setIssues(response.issues);

      if (webSearchResults.length > 0) {
        const failed = webSearchResults.some((result) => result.status === 'rejected');
        setWebNotice({
          kind: failed ? 'error' : 'info',
          text: failed ? copy.webProviderOpenFailed : copy.webSearchOpened,
        });
      }
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
          {webProviders.map((provider) => (
            <label className="omi-provider-toggle omi-provider-toggle-web" key={provider.id}>
              <input
                type="checkbox"
                checked={provider.enabled}
                onChange={(event) =>
                  toggleWebProvider(provider.id, event.target.checked)
                }
              />
              <span>{provider.name}</span>
              <small>web</small>
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

      <section className="omi-web-provider-section" aria-labelledby="omi-web-provider-title">
        <div className="omi-web-provider-heading">
          <div>
            <h5 id="omi-web-provider-title">{copy.webProvidersTitle}</h5>
            <p>{copy.webProvidersDescription}</p>
          </div>
          <div className="omi-web-provider-add-actions">
            <button
              type="button"
              className="studio-menu-secondary-action"
              onClick={addAcademiaProvider}
            >
              <Plus size={15} aria-hidden="true" />
              {copy.addAcademia}
            </button>
            <button
              type="button"
              className="studio-menu-secondary-action"
              onClick={() => setShowCustomProvider((visible) => !visible)}
            >
              <Plus size={15} aria-hidden="true" />
              {copy.addCustomProvider}
            </button>
          </div>
        </div>

        {showCustomProvider ? (
          <div className="omi-web-provider-form">
            <label>
              <span>{copy.providerName}</span>
              <input
                value={providerDraft.name}
                onChange={(event) =>
                  setProviderDraft({ ...providerDraft, name: event.target.value })
                }
                autoComplete="off"
              />
            </label>
            <label>
              <span>{copy.loginUrl}</span>
              <input
                type="url"
                value={providerDraft.loginUrl}
                placeholder="https://example.org/login"
                onChange={(event) =>
                  setProviderDraft({ ...providerDraft, loginUrl: event.target.value })
                }
                autoComplete="off"
              />
            </label>
            <label className="omi-web-provider-form-wide">
              <span>{copy.searchUrlTemplate}</span>
              <input
                type="url"
                value={providerDraft.searchUrlTemplate}
                placeholder="https://example.org/search?q={query}"
                onChange={(event) =>
                  setProviderDraft({
                    ...providerDraft,
                    searchUrlTemplate: event.target.value,
                  })
                }
                autoComplete="off"
              />
              <small>{copy.searchUrlTemplateHint}</small>
            </label>
            <label className="omi-web-provider-form-wide">
              <span>{copy.logoutUrl}</span>
              <input
                type="url"
                value={providerDraft.logoutUrl ?? ''}
                placeholder="https://example.org/logout"
                onChange={(event) =>
                  setProviderDraft({ ...providerDraft, logoutUrl: event.target.value })
                }
                autoComplete="off"
              />
              <small>{copy.logoutUrlHint}</small>
            </label>
            <div className="omi-web-provider-form-actions">
              <button
                type="button"
                className="studio-menu-primary-action"
                onClick={addCustomProvider}
              >
                <Plus size={15} aria-hidden="true" />
                {copy.addProvider}
              </button>
              <button
                type="button"
                className="studio-menu-secondary-action"
                onClick={() => {
                  setProviderDraft(EMPTY_WEB_PROVIDER_DRAFT);
                  setShowCustomProvider(false);
                }}
              >
                {copy.cancel}
              </button>
            </div>
          </div>
        ) : null}

        {webProviders.length > 0 ? (
          <div className="omi-web-provider-list">
            {webProviders.map((provider) => (
              <article className="omi-web-provider-card" key={provider.id}>
                <div className="omi-web-provider-card-main">
                  <label>
                    <input
                      type="checkbox"
                      checked={provider.enabled}
                      onChange={(event) =>
                        toggleWebProvider(provider.id, event.target.checked)
                      }
                    />
                    <strong>{provider.name}</strong>
                  </label>
                  <small>{providerHost(provider)}</small>
                </div>
                <div className="omi-web-provider-card-actions">
                  <button
                    type="button"
                    className="studio-menu-secondary-action"
                    onClick={() => void openProviderLogin(provider)}
                  >
                    <LogIn size={15} aria-hidden="true" />
                    {copy.signIn}
                  </button>
                  <button
                    type="button"
                    className="studio-menu-secondary-action"
                    disabled={query.trim().length < 2}
                    onClick={() => void searchWebProvider(provider)}
                  >
                    <Search size={15} aria-hidden="true" />
                    {copy.searchProvider}
                  </button>
                  <button
                    type="button"
                    className="studio-menu-secondary-action"
                    onClick={() => void signOutWebProvider(provider)}
                  >
                    <LogOut size={15} aria-hidden="true" />
                    {copy.signOut}
                  </button>
                  <button
                    type="button"
                    className="studio-menu-secondary-action"
                    aria-label={`${copy.removeProvider}: ${provider.name}`}
                    title={copy.removeProvider}
                    onClick={() => void removeWebProvider(provider)}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : null}

        <p className="omi-lookup-privacy-note omi-web-provider-privacy-note">
          {copy.webSessionPrivacyNote}
        </p>

        {webNotice ? (
          <p
            className={`omi-web-provider-notice omi-web-provider-notice-${webNotice.kind}`}
            role="status"
          >
            {webNotice.text}
          </p>
        ) : null}
      </section>

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

      {searched && !loading && providerCount > 0 && results.length === 0 ? (
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

function providerHost(provider: WebBibliographicProvider): string {
  try {
    return new URL(provider.loginUrl).hostname;
  } catch {
    return provider.loginUrl;
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
