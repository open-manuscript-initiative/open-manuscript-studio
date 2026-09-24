import { Edit3, ExternalLink, Library, Plus, RefreshCw, Save, Search, Settings2, Trash2, Upload } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';

import {
  stageAddBibliographicRecord,
  stageAddBibliographicRecords,
  stageSetBibliographyRecordIncluded,
  stageSetCitationStyle,
} from '../app/citationActions';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getCslRenderingCopy } from '../i18n/cslRendering';
import {
  countCitationsForRecord,
  formatBibliographyEntry,
  getBibliographicIdentifier,
  getBibliographyRecords,
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
import { parseReferenceInterchange } from '../services/referenceInterchange';
import {
  listPersonalReferenceLibrary,
  savePersonalReferenceRecords,
} from '../services/referenceManagerApi';
import type { OmiBibliographicRecord, OmiCitationStyleId } from '../types/omi';
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

function personalReferenceLibraryCopy(locale: string) {
  if (locale === 'hu') {
    return {
      title: 'Saját hivatkozástár',
      description:
        'A fiókodhoz mentett bibliográfiai tételeket bármely dokumentumban újra felhasználhatod. A dokumentumba átvett tétel hordozható pillanatképként a kéziratban is megmarad.',
      saveCurrent: 'Dokumentum tételeinek mentése a saját tárba',
      saved: (count: number) => `${count} tétel mentve a saját hivatkozástárba.`,
      saveFailed: 'A saját hivatkozástár mentése sikertelen.',
      loadFailed: 'A saját hivatkozástár betöltése sikertelen.',
      empty: 'A saját hivatkozástár még üres.',
      search: 'Keresés a saját hivatkozástárban',
      add: 'Hozzáadás a dokumentumhoz',
      inDocument: 'Már a dokumentumban',
      refresh: 'Frissítés',
      include: 'Szerepeljen a hivatkozáslistában',
      cited: 'Idézett mű – automatikusan szerepel a hivatkozáslistában',
    };
  }
  if (locale === 'de') {
    return {
      title: 'Persönliche Literaturbibliothek',
      description:
        'Im Konto gespeicherte Literaturangaben können in mehreren Dokumenten wiederverwendet werden. In das Dokument übernommene Datensätze bleiben als portable Momentaufnahme im Manuskript erhalten.',
      saveCurrent: 'Dokumentreferenzen in der persönlichen Bibliothek speichern',
      saved: (count: number) => `${count} Einträge in der persönlichen Bibliothek gespeichert.`,
      saveFailed: 'Die persönliche Literaturbibliothek konnte nicht gespeichert werden.',
      loadFailed: 'Die persönliche Literaturbibliothek konnte nicht geladen werden.',
      empty: 'Die persönliche Literaturbibliothek ist noch leer.',
      search: 'Persönliche Literaturbibliothek durchsuchen',
      add: 'Zum Dokument hinzufügen',
      inDocument: 'Bereits im Dokument',
      refresh: 'Aktualisieren',
      include: 'Im Literaturverzeichnis anzeigen',
      cited: 'Zitiert – wird automatisch im Literaturverzeichnis angezeigt',
    };
  }
  return {
    title: 'Personal reference library',
    description:
      'Bibliographic records saved to your account can be reused across documents. A record copied into a document remains a portable manuscript snapshot.',
    saveCurrent: 'Save document references to personal library',
    saved: (count: number) => `${count} records saved to the personal reference library.`,
    saveFailed: 'The personal reference library could not be saved.',
    loadFailed: 'The personal reference library could not be loaded.',
    empty: 'Your personal reference library is empty.',
    search: 'Search personal reference library',
    add: 'Add to document',
    inDocument: 'Already in document',
    refresh: 'Refresh',
    include: 'Include in bibliography',
    cited: 'Cited work – automatically included in the bibliography',
  };
}

function referenceInterchangeCopy(locale: string) {
  const formatLabel = (format: string) =>
    format === 'csl-json' ? 'CSL JSON' : format === 'bibtex' ? 'BibTeX' : 'RIS';

  if (locale === 'hu') {
    return {
      title: 'Referenciakezelő-fájlok',
      description:
        'RIS, BibTeX vagy CSL JSON könyvtár importálható. A Stúdió a már meglévő DOI- vagy azonos bibliográfiai rekordokat nem duplikálja.',
      importLibrary: 'Könyvtár importálása',
      imported: (added: number, skipped: number, format: string, issues: number) =>
        `${formatLabel(format)}: ${added} rekord importálva, ${skipped} kihagyva${issues ? `, ${issues} figyelmeztetéssel` : ''}.`,
      failed: 'A referenciakönyvtár importálása sikertelen.',
    };
  }
  if (locale === 'de') {
    return {
      title: 'Literaturverwaltungsdateien',
      description:
        'RIS-, BibTeX- oder CSL-JSON-Bibliotheken können importiert werden. Vorhandene DOI- oder übereinstimmende bibliografische Datensätze werden nicht dupliziert.',
      importLibrary: 'Bibliothek importieren',
      imported: (added: number, skipped: number, format: string, issues: number) =>
        `${formatLabel(format)}: ${added} Datensätze importiert, ${skipped} übersprungen${issues ? `, ${issues} Warnungen` : ''}.`,
      failed: 'Die Literaturbibliothek konnte nicht importiert werden.',
    };
  }
  return {
    title: 'Reference-manager files',
    description:
      'Import RIS, BibTeX, or CSL JSON libraries. Existing DOI or matching bibliographic records are not duplicated.',
    importLibrary: 'Import library',
    imported: (added: number, skipped: number, format: string, issues: number) =>
      `${formatLabel(format)}: ${added} records imported, ${skipped} skipped${issues ? `, ${issues} warnings` : ''}.`,
    failed: 'The reference library could not be imported.',
  };
}

export function ReferencesPanel() {
  const { t, locale } = useTranslation();
  const copy = getCslRenderingCopy(locale);
  const interchangeCopy = referenceInterchangeCopy(locale);
  const personalCopy = personalReferenceLibraryCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const records = useMemo(
    () => manuscript.bibliographicRecords ?? [],
    [manuscript.bibliographicRecords],
  );
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
  const interchangeInputRef = useRef<HTMLInputElement>(null);
  const [interchangeStatus, setInterchangeStatus] = useState<string | null>(null);
  const [interchangeError, setInterchangeError] = useState<string | null>(null);
  const [personalRecords, setPersonalRecords] = useState<OmiBibliographicRecord[]>([]);
  const [personalQuery, setPersonalQuery] = useState('');
  const [personalBusy, setPersonalBusy] = useState(false);
  const [personalStatus, setPersonalStatus] = useState<string | null>(null);
  const [personalError, setPersonalError] = useState<string | null>(null);

  const refreshPersonalLibrary = useCallback(async () => {
    setPersonalBusy(true);
    setPersonalError(null);
    try {
      setPersonalRecords(await listPersonalReferenceLibrary());
    } catch (reason) {
      setPersonalError(
        reason instanceof Error ? reason.message : personalCopy.loadFailed,
      );
    } finally {
      setPersonalBusy(false);
    }
  }, [personalCopy.loadFailed]);

  useEffect(() => {
    setSavedCustomStyles(readSavedCustomStyles());
  }, []);

  useEffect(() => {
    void refreshPersonalLibrary();
  }, [refreshPersonalLibrary]);

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
  const additionalBibliographyIds = useMemo(
    () => new Set(manuscript.bibliographyAdditionalRecordIds ?? []),
    [manuscript.bibliographyAdditionalRecordIds],
  );
  const bibliography = useMemo(
    () =>
      renderBibliography(
        getBibliographyRecords(manuscript),
        citationStyle,
        manuscript.locale,
      ),
    [citationStyle, manuscript],
  );
  const normalizedPersonalQuery = personalQuery.trim().toLocaleLowerCase();
  const filteredPersonalRecords = useMemo(
    () =>
      personalRecords.filter((record) =>
        !normalizedPersonalQuery ||
        formatBibliographyEntry(record).toLocaleLowerCase().includes(normalizedPersonalQuery),
      ),
    [normalizedPersonalQuery, personalRecords],
  );
  const documentRecordIds = useMemo(
    () => new Set(records.map((record) => record.id)),
    [records],
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

  async function importReferenceLibrary(
    event: ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setInterchangeStatus(null);
    setInterchangeError(null);
    try {
      const parsed = parseReferenceInterchange(
        await file.text(),
        undefined,
        file.name,
      );
      const imported = stageAddBibliographicRecords(parsed.records);
      setInterchangeStatus(
        interchangeCopy.imported(
          imported.added,
          imported.skipped,
          parsed.format,
          parsed.issues.length,
        ),
      );
    } catch (reason) {
      setInterchangeError(
        reason instanceof Error ? reason.message : interchangeCopy.failed,
      );
    }
  }

  async function saveCurrentReferencesToPersonalLibrary(): Promise<void> {
    if (!records.length || personalBusy) return;
    setPersonalBusy(true);
    setPersonalError(null);
    setPersonalStatus(null);
    try {
      const saved = await savePersonalReferenceRecords(records);
      setPersonalStatus(personalCopy.saved(saved));
      setPersonalRecords(await listPersonalReferenceLibrary());
    } catch (reason) {
      setPersonalError(
        reason instanceof Error ? reason.message : personalCopy.saveFailed,
      );
    } finally {
      setPersonalBusy(false);
    }
  }

  function addPersonalRecordToDocument(record: OmiBibliographicRecord): void {
    if (!documentRecordIds.has(record.id)) {
      stageAddBibliographicRecord(record);
    }
    stageSetBibliographyRecordIncluded(record.id, true);
  }

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
        <div className="omi-reference-item-actions">
          <input
            ref={interchangeInputRef}
            type="file"
            hidden
            accept=".ris,.bib,.bibtex,.json,.csljson,application/json,text/plain"
            onChange={(event) => void importReferenceLibrary(event)}
          />
          <button
            type="button"
            className="studio-menu-secondary-action"
            onClick={() => interchangeInputRef.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            {interchangeCopy.importLibrary}
          </button>
          <button type="button" className="studio-menu-primary-action" onClick={() => setCreating(true)}>
            <Plus size={16} aria-hidden="true" />
            {t('citations.addReference')}
          </button>
        </div>
      </div>

      <section className="omi-reference-interchange-note">
        <strong>{interchangeCopy.title}</strong>
        <p>{interchangeCopy.description}</p>
        {interchangeStatus ? <small role="status">{interchangeStatus}</small> : null}
        {interchangeError ? (
          <small className="omi-integration-error" role="alert">
            {interchangeError}
          </small>
        ) : null}
      </section>

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

      <section className="omi-personal-reference-library">
        <div className="omi-reference-subheading">
          <div>
            <h4><Library size={17} aria-hidden="true" /> {personalCopy.title}</h4>
            <p>{personalCopy.description}</p>
          </div>
          <div className="omi-reference-item-actions">
            <button
              type="button"
              className="studio-menu-secondary-action"
              disabled={personalBusy || records.length === 0}
              onClick={() => void saveCurrentReferencesToPersonalLibrary()}
            >
              <Save size={16} aria-hidden="true" />
              {personalCopy.saveCurrent}
            </button>
            <button
              type="button"
              className="omi-reference-icon-action"
              disabled={personalBusy}
              aria-label={personalCopy.refresh}
              title={personalCopy.refresh}
              onClick={() => void refreshPersonalLibrary()}
            >
              <RefreshCw size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {personalStatus ? <small role="status">{personalStatus}</small> : null}
        {personalError ? (
          <small className="omi-integration-error" role="alert">{personalError}</small>
        ) : null}

        {personalRecords.length > 0 ? (
          <>
            <label className="omi-reference-search">
              <Search size={16} aria-hidden="true" />
              <span className="sr-only">{personalCopy.search}</span>
              <input
                value={personalQuery}
                onChange={(event) => setPersonalQuery(event.target.value)}
                placeholder={personalCopy.search}
              />
            </label>
            <ul className="omi-reference-list omi-personal-reference-list">
              {filteredPersonalRecords.map((record) => {
                const inDocument = documentRecordIds.has(record.id);
                return (
                  <li className="omi-reference-item" key={record.id}>
                    <div className="omi-reference-item-main">
                      <strong>{record.title || t('citations.untitledReference')}</strong>
                      <p>{formatBibliographyEntry(record)}</p>
                    </div>
                    <button
                      type="button"
                      className="studio-menu-secondary-action"
                      disabled={inDocument}
                      onClick={() => addPersonalRecordToDocument(record)}
                    >
                      <Plus size={15} aria-hidden="true" />
                      {inDocument ? personalCopy.inDocument : personalCopy.add}
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        ) : (
          <div className="omi-reference-empty">
            <strong>{personalCopy.empty}</strong>
          </div>
        )}
      </section>

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
                  <label className="omi-reference-bibliography-toggle">
                    <input
                      type="checkbox"
                      checked={citationCount > 0 || additionalBibliographyIds.has(record.id)}
                      disabled={citationCount > 0}
                      onChange={(event) =>
                        stageSetBibliographyRecordIncluded(record.id, event.target.checked)
                      }
                    />
                    <span>{citationCount > 0 ? personalCopy.cited : personalCopy.include}</span>
                  </label>
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
