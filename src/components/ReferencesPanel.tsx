import { Edit3, ExternalLink, Plus, Search, Settings2, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { stageSetCitationStyle } from '../app/citationActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCslRenderingCopy } from '../i18n/cslRendering';
import {
  countCitationsForRecord,
  formatBibliographyEntry,
  getBibliographicIdentifier,
} from '../model/citations';
import {
  CITATION_STYLE_CATALOG,
  CITATION_STYLE_IDS,
  DEFAULT_CITATION_STYLE,
  createCustomCitationStyleId,
  getCitationStyleDescriptor,
  parseCustomCitationStyleId,
  renderBibliography,
  type CustomCitationStyleConfig,
} from '../model/cslRendering';
import type { OmiCitationStyleId } from '../types/omi';
import { BibliographicRecordEditor } from './BibliographicRecordEditor';
import { ReferenceLookupPanel } from './ReferenceLookupPanel';

const CUSTOM_STYLE_STORAGE_KEY = 'omi.customCitationStyles.v1';

function readSavedCustomStyles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value = JSON.parse(window.localStorage.getItem(CUSTOM_STYLE_STORAGE_KEY) ?? '[]');
    return Array.isArray(value)
      ? value.filter((candidate): candidate is string =>
          typeof candidate === 'string' && Boolean(parseCustomCitationStyleId(candidate)),
        )
      : [];
  } catch {
    return [];
  }
}

function writeSavedCustomStyles(styles: readonly string[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(CUSTOM_STYLE_STORAGE_KEY, JSON.stringify(styles));
}

export function ReferencesPanel() {
  const { t, locale } = useTranslation();
  const copy = getCslRenderingCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const records = manuscript.bibliographicRecords ?? [];
  const citationStyle = manuscript.citationStyle ?? DEFAULT_CITATION_STYLE;
  const [query, setQuery] = useState('');
  const [styleQuery, setStyleQuery] = useState('');
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [showCustomEditor, setShowCustomEditor] = useState(false);
  const [savedCustomStyles, setSavedCustomStyles] = useState<string[]>([]);
  const [customStatus, setCustomStatus] = useState<string | null>(null);
  const [customName, setCustomName] = useState('');
  const [customBaseStyle, setCustomBaseStyle] = useState<CustomCitationStyleConfig['baseStyle']>('apa-7');
  const [citationPrefix, setCitationPrefix] = useState('(');
  const [citationSuffix, setCitationSuffix] = useState(')');
  const [citationDelimiter, setCitationDelimiter] = useState('; ');
  const [bibliographyPrefix, setBibliographyPrefix] = useState('');
  const [bibliographySuffix, setBibliographySuffix] = useState('');
  const [uppercaseAuthors, setUppercaseAuthors] = useState(false);

  useEffect(() => {
    setSavedCustomStyles(readSavedCustomStyles());
  }, []);

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filtered = useMemo(
    () =>
      records.filter((record) => {
        if (!normalizedQuery) return true;
        return formatBibliographyEntry(record).toLocaleLowerCase().includes(normalizedQuery);
      }),
    [normalizedQuery, records],
  );
  const citedRecordIds = useMemo(
    () => new Set(manuscript.citations.map((citation) => citation.target)),
    [manuscript.citations],
  );
  const bibliography = useMemo(
    () =>
      renderBibliography(
        records.filter((record) => citedRecordIds.has(record.id)),
        citationStyle,
        manuscript.locale,
      ),
    [citationStyle, citedRecordIds, manuscript.locale, records],
  );

  const normalizedStyleQuery = styleQuery.trim().toLocaleLowerCase();
  const filteredStyles = useMemo(
    () => CITATION_STYLE_CATALOG.filter((entry) =>
      !normalizedStyleQuery ||
      `${entry.label} ${entry.category} ${entry.id}`.toLocaleLowerCase().includes(normalizedStyleQuery),
    ),
    [normalizedStyleQuery],
  );
  const categories = useMemo(
    () => Array.from(new Set(filteredStyles.map((entry) => entry.category))),
    [filteredStyles],
  );
  const activeDescriptor = getCitationStyleDescriptor(String(citationStyle));

  function saveCustomStyle(): void {
    if (!customName.trim()) {
      setCustomStatus(copy.customStyleNameRequired);
      return;
    }
    const config: CustomCitationStyleConfig = {
      name: customName.trim(),
      baseStyle: customBaseStyle,
      citationPrefix,
      citationSuffix,
      citationDelimiter,
      bibliographyPrefix,
      bibliographySuffix,
      uppercaseAuthors,
    };
    const id = createCustomCitationStyleId(config);
    const next = [
      ...savedCustomStyles.filter((candidate) =>
        parseCustomCitationStyleId(candidate)?.name.toLocaleLowerCase() !== config.name.toLocaleLowerCase(),
      ),
      id,
    ];
    setSavedCustomStyles(next);
    writeSavedCustomStyles(next);
    stageSetCitationStyle(id as OmiCitationStyleId);
    setCustomStatus(copy.customStyleSaved);
    setShowCustomEditor(false);
  }

  function removeCustomStyle(id: string): void {
    const next = savedCustomStyles.filter((candidate) => candidate !== id);
    setSavedCustomStyles(next);
    writeSavedCustomStyles(next);
    if (String(citationStyle) === id) {
      stageSetCitationStyle(DEFAULT_CITATION_STYLE);
    }
  }

  if (creating || editingRecordId) {
    return (
      <section className="studio-menu-view">
        <BibliographicRecordEditor
          recordId={editingRecordId ?? undefined}
          onDone={() => {
            setCreating(false);
            setEditingRecordId(null);
          }}
        />
      </section>
    );
  }

  return (
    <section className="studio-menu-view omi-references-panel">
      <div className="studio-menu-view-header">
        <div>
          <h3>{t('citations.referencesTitle')}</h3>
          <p>{t('citations.referencesDescription')}</p>
        </div>
        <button type="button" className="studio-menu-primary-action" onClick={() => setCreating(true)}>
          <Plus size={16} aria-hidden="true" />
          {t('citations.addReference')}
        </button>
      </div>

      <section className="omi-csl-style-panel">
        <div>
          <h4>{copy.styleTitle}</h4>
          <p>{copy.styleDescription}</p>
        </div>

        <label className="omi-reference-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{copy.searchStyles}</span>
          <input
            value={styleQuery}
            onChange={(event) => setStyleQuery(event.target.value)}
            placeholder={copy.searchStyles}
          />
        </label>

        <label>
          <span>{copy.styleTitle}</span>
          <select
            value={String(citationStyle)}
            onChange={(event) => stageSetCitationStyle(event.target.value as OmiCitationStyleId)}
          >
            {parseCustomCitationStyleId(String(citationStyle)) &&
            !savedCustomStyles.includes(String(citationStyle)) ? (
              <option value={String(citationStyle)}>{activeDescriptor.label}</option>
            ) : null}
            {savedCustomStyles.length > 0 ? (
              <optgroup label={copy.customStyles}>
                {savedCustomStyles.map((id) => (
                  <option value={id} key={id}>{parseCustomCitationStyleId(id)?.name ?? id}</option>
                ))}
              </optgroup>
            ) : null}
            {categories.map((category) => (
              <optgroup label={category} key={category}>
                {filteredStyles.filter((entry) => entry.category === category).map((entry) => (
                  <option value={entry.id} key={entry.id}>{entry.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>

        <div className="omi-reference-item-actions">
          <button
            type="button"
            className="studio-menu-secondary-action"
            onClick={() => {
              setShowCustomEditor((value) => !value);
              setCustomStatus(null);
            }}
          >
            <Settings2 size={16} aria-hidden="true" />
            {copy.createCustomStyle}
          </button>
        </div>

        {showCustomEditor ? (
          <div className="omi-bibliography-preview omi-bibliography-preview--csl">
            <h4>{copy.createCustomStyle}</h4>
            <div className="contributor-form-grid">
              <label className="contributor-wide-field">
                <span>{copy.customStyleName}</span>
                <input value={customName} onChange={(event) => setCustomName(event.target.value)} />
              </label>
              <label>
                <span>{copy.baseStyle}</span>
                <select value={customBaseStyle} onChange={(event) => setCustomBaseStyle(event.target.value as CustomCitationStyleConfig['baseStyle'])}>
                  {CITATION_STYLE_IDS.map((id) => <option key={id} value={id}>{copy.styleNames[id] ?? id}</option>)}
                </select>
              </label>
              <label><span>{copy.citationPrefix}</span><input value={citationPrefix} onChange={(event) => setCitationPrefix(event.target.value)} /></label>
              <label><span>{copy.citationSuffix}</span><input value={citationSuffix} onChange={(event) => setCitationSuffix(event.target.value)} /></label>
              <label><span>{copy.citationDelimiter}</span><input value={citationDelimiter} onChange={(event) => setCitationDelimiter(event.target.value)} /></label>
              <label><span>{copy.bibliographyPrefix}</span><input value={bibliographyPrefix} onChange={(event) => setBibliographyPrefix(event.target.value)} /></label>
              <label><span>{copy.bibliographySuffix}</span><input value={bibliographySuffix} onChange={(event) => setBibliographySuffix(event.target.value)} /></label>
            </div>
            <label className="contributor-checkbox">
              <input type="checkbox" checked={uppercaseAuthors} onChange={(event) => setUppercaseAuthors(event.target.checked)} />
              {copy.uppercaseAuthors}
            </label>
            <div className="omi-reference-item-actions">
              <button type="button" className="studio-menu-primary-action" onClick={saveCustomStyle}>{copy.saveCustomStyle}</button>
              <button type="button" className="studio-menu-secondary-action" onClick={() => setShowCustomEditor(false)}>{copy.cancel}</button>
            </div>
          </div>
        ) : null}

        {savedCustomStyles.length > 0 ? (
          <div>
            <strong>{copy.customStyles}</strong>
            <ul className="omi-reference-list">
              {savedCustomStyles.map((id) => (
                <li className="omi-reference-item" key={id}>
                  <span>{parseCustomCitationStyleId(id)?.name ?? id}</span>
                  <button
                    type="button"
                    className="omi-reference-icon-action"
                    aria-label={copy.deleteCustomStyle}
                    title={copy.deleteCustomStyle}
                    onClick={() => removeCustomStyle(id)}
                  >
                    <Trash2 size={16} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {customStatus ? <small role="status">{customStatus}</small> : null}
        <small>{copy.styleProfileNote}</small>
      </section>

      <ReferenceLookupPanel />

      {records.length > 0 ? (
        <label className="omi-reference-search">
          <Search size={16} aria-hidden="true" />
          <span className="sr-only">{t('citations.searchReferences')}</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('citations.searchPlaceholder')} />
        </label>
      ) : null}

      {records.length === 0 ? (
        <div className="omi-reference-empty">
          <strong>{t('citations.emptyLibrary')}</strong>
          <p>{t('citations.emptyLibraryHint')}</p>
        </div>
      ) : (
        <ol className="omi-reference-list">
          {filtered.map((record) => {
            const citationCount = countCitationsForRecord(manuscript.citations, record.id);
            const doi = getBibliographicIdentifier(record, 'doi');
            const onlineUrl = record.url || (doi ? `https://doi.org/${doi}` : undefined);
            return (
              <li className="omi-reference-item" key={record.id}>
                <div className="omi-reference-item-main">
                  <div className="omi-reference-item-heading">
                    <strong>{record.title || t('citations.untitledReference')}</strong>
                    <span className="omi-reference-status">{citationCount} {t('citations.occurrences')}</span>
                  </div>
                  <p>{formatBibliographyEntry(record)}</p>
                  <div className="omi-reference-item-meta"><code>{record.id}</code><span>{record.type}</span><span>{record.status}</span></div>
                </div>
                <div className="omi-reference-item-actions">
                  {onlineUrl ? (
                    <a className="omi-reference-icon-action" href={onlineUrl} target="_blank" rel="noopener noreferrer" aria-label={t('citations.openSource')} title={t('citations.openSource')}>
                      <ExternalLink size={16} aria-hidden="true" />
                    </a>
                  ) : null}
                  <button type="button" className="omi-reference-icon-action" onClick={() => setEditingRecordId(record.id)} aria-label={t('citations.editReference')} title={t('citations.editReference')}>
                    <Edit3 size={16} aria-hidden="true" />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {bibliography.length > 0 ? (
        <section className="omi-bibliography-preview omi-bibliography-preview--csl">
          <h4>{copy.bibliographyTitle}</h4>
          <p>{copy.bibliographyDescription}</p>
          <ol>{bibliography.map((entry) => <li key={entry.recordId}>{entry.text}</li>)}</ol>
        </section>
      ) : null}
    </section>
  );
}
