import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';

import {
  stageAddBibliographicRecord,
  stageUpdateBibliographicRecord,
} from '../app/citationActions';
import { useStudioStore } from '../app/useStudioStore';
import { type AppTranslationKey, useTranslation } from '../i18n';
import {
  BIBLIOGRAPHIC_RESOURCE_TYPES,
  createBibliographicContributor,
  createBibliographicRecord,
  findLikelyDuplicateRecord,
  getBibliographicIdentifier,
  normalizeBibliographicRecord,
  setBibliographicIdentifier,
} from '../model/citations';
import {
  fetchPersonalReferenceManagerRecord,
  getReferenceManagerSource,
  mergeReferenceManagerRecord,
} from '../services/referenceManagerApi';
import type {
  OmiBibliographicContributor,
  OmiBibliographicRecord,
} from '../types/omi';

interface BibliographicRecordEditorProps {
  recordId?: string;
  onDone: () => void;
}

export function BibliographicRecordEditor({
  recordId,
  onDone,
}: BibliographicRecordEditorProps) {
  const { t, locale } = useTranslation();
  const managerCopy = referenceManagerRefreshCopy(locale);
  const records = useStudioStore(
    (state) => state.manuscript.bibliographicRecords ?? [],
  );
  const existing = records.find((record) => record.id === recordId);
  const initial = useMemo(
    () =>
      existing
        ? cloneRecord(existing)
        : createBibliographicRecord({
            type: 'journal-article',
          }),
    [existing],
  );
  const [draft, setDraft] = useState<OmiBibliographicRecord>(initial);
  const [duplicateTitle, setDuplicateTitle] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState('');
  const [refreshError, setRefreshError] = useState('');
  const managerSource = useMemo(
    () => existing ? getReferenceManagerSource(existing) : null,
    [existing],
  );
  const doi = getBibliographicIdentifier(draft, 'doi') ?? '';

  function update(patch: Partial<OmiBibliographicRecord>): void {
    setDraft((current) => ({ ...current, ...patch }));
    setDuplicateTitle(null);
  }

  function updateContributor(
    contributorId: string,
    patch: Partial<OmiBibliographicContributor>,
  ): void {
    update({
      contributors: draft.contributors.map((contributor) =>
        contributor.id === contributorId
          ? { ...contributor, ...patch }
          : contributor,
      ),
    });
  }

  async function refreshFromReferenceManager(): Promise<void> {
    if (!existing || !managerSource) return;
    setRefreshing(true);
    setRefreshNotice('');
    setRefreshError('');
    try {
      const source = await fetchPersonalReferenceManagerRecord(
        managerSource.provider,
        managerSource.externalId,
      );
      setDraft(mergeReferenceManagerRecord(existing, source));
      setDuplicateTitle(null);
      setRefreshNotice(managerCopy.loaded);
    } catch (reason) {
      setRefreshError(
        reason instanceof Error ? reason.message : managerCopy.failed,
      );
    } finally {
      setRefreshing(false);
    }
  }

  function save(): void {
    const normalized = normalizeBibliographicRecord(draft);

    if (!normalized.title) {
      return;
    }

    const duplicate = findLikelyDuplicateRecord(
      records.filter((record) => record.id !== recordId),
      normalized,
    );

    if (duplicate) {
      setDuplicateTitle(duplicate.title);
      return;
    }

    const saved = recordId
      ? stageUpdateBibliographicRecord(recordId, normalized)
      : stageAddBibliographicRecord(normalized);

    if (saved) {
      onDone();
    }
  }

  return (
    <section className="omi-reference-editor">
      <header className="omi-reference-editor-header">
        <div>
          <h4>
            {recordId
              ? t('citations.editReference')
              : t('citations.addReference')}
          </h4>
          <p>{t('citations.referenceEditorDescription')}</p>
        </div>
        {managerSource ? (
          <button
            type="button"
            className="studio-menu-secondary-action"
            disabled={refreshing}
            onClick={() => void refreshFromReferenceManager()}
          >
            <RefreshCw
              size={15}
              aria-hidden="true"
              className={refreshing ? 'is-loading' : undefined}
            />
            {refreshing
              ? managerCopy.refreshing
              : managerCopy.refreshFrom(managerSource.provider)}
          </button>
        ) : null}
      </header>

      {managerSource ? (
        <p className="omi-integration-secret-note">
          {managerCopy.linkedTo(managerSource.provider)}
        </p>
      ) : null}
      {refreshNotice ? <p role="status">{refreshNotice}</p> : null}
      {refreshError ? (
        <p className="omi-integration-error" role="alert">{refreshError}</p>
      ) : null}

      <div className="omi-reference-form-grid">
        <label>
          <span>{t('citations.resourceType')}</span>
          <select
            value={draft.type}
            onChange={(event) => update({ type: event.target.value })}
          >
            {BIBLIOGRAPHIC_RESOURCE_TYPES.map((type) => (
              <option value={type} key={type}>
                {resourceTypeLabel(type, t)}
              </option>
            ))}
          </select>
        </label>

        <label className="omi-reference-field-wide">
          <span>{t('citations.title')}</span>
          <input
            value={draft.title}
            onChange={(event) => update({ title: event.target.value })}
            placeholder={t('citations.titlePlaceholder')}
            autoFocus
          />
        </label>

        <label className="omi-reference-field-wide">
          <span>{t('citations.subtitle')}</span>
          <input
            value={draft.subtitle ?? ''}
            onChange={(event) => update({ subtitle: event.target.value })}
          />
        </label>
      </div>

      <section className="omi-reference-contributors">
        <div className="omi-reference-subheading">
          <div>
            <strong>{t('citations.creators')}</strong>
            <p>{t('citations.creatorsDescription')}</p>
          </div>
          <button
            type="button"
            className="studio-menu-secondary-action"
            onClick={() =>
              update({
                contributors: [
                  ...draft.contributors,
                  createBibliographicContributor('author'),
                ],
              })
            }
          >
            <Plus size={15} aria-hidden="true" />
            {t('citations.addCreator')}
          </button>
        </div>

        {draft.contributors.length === 0 ? (
          <p className="studio-muted-value">{t('citations.noCreators')}</p>
        ) : (
          <div className="omi-reference-contributor-list">
            {draft.contributors.map((contributor) => (
              <div className="omi-reference-contributor" key={contributor.id}>
                <label>
                  <span>{t('citations.creatorRole')}</span>
                  <select
                    value={contributor.role}
                    onChange={(event) =>
                      updateContributor(contributor.id, {
                        role: event.target.value,
                      })
                    }
                  >
                    <option value="author">{t('citations.roles.author')}</option>
                    <option value="editor">{t('citations.roles.editor')}</option>
                    <option value="translator">{t('citations.roles.translator')}</option>
                    <option value="compiler">{t('citations.roles.compiler')}</option>
                    <option value="contributor">{t('citations.roles.contributor')}</option>
                  </select>
                </label>
                <label>
                  <span>{t('citations.givenName')}</span>
                  <input
                    value={contributor.givenName ?? ''}
                    onChange={(event) =>
                      updateContributor(contributor.id, {
                        givenName: event.target.value,
                      })
                    }
                  />
                </label>
                <label>
                  <span>{t('citations.familyName')}</span>
                  <input
                    value={contributor.familyName ?? ''}
                    onChange={(event) =>
                      updateContributor(contributor.id, {
                        familyName: event.target.value,
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="omi-reference-remove-contributor"
                  aria-label={t('citations.removeCreator')}
                  title={t('citations.removeCreator')}
                  onClick={() =>
                    update({
                      contributors: draft.contributors.filter(
                        (item) => item.id !== contributor.id,
                      ),
                    })
                  }
                >
                  <Trash2 size={15} aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="omi-reference-form-grid">
        <label className="omi-reference-field-wide">
          <span>{t('citations.containerTitle')}</span>
          <input
            value={draft.containerTitle ?? ''}
            onChange={(event) => update({ containerTitle: event.target.value })}
          />
        </label>
        <label>
          <span>{t('citations.issued')}</span>
          <input
            value={draft.issued ?? ''}
            onChange={(event) => update({ issued: event.target.value })}
          />
        </label>
        <label>
          <span>{t('citations.volume')}</span>
          <input
            value={draft.volume ?? ''}
            onChange={(event) => update({ volume: event.target.value })}
          />
        </label>
        <label>
          <span>{t('citations.issue')}</span>
          <input
            value={draft.issue ?? ''}
            onChange={(event) => update({ issue: event.target.value })}
          />
        </label>
        <label>
          <span>{t('citations.pages')}</span>
          <input
            value={draft.pages ?? ''}
            onChange={(event) => update({ pages: event.target.value })}
          />
        </label>
        <label>
          <span>{t('citations.publisher')}</span>
          <input
            value={draft.publisher ?? ''}
            onChange={(event) => update({ publisher: event.target.value })}
          />
        </label>
        <label>
          <span>{t('citations.place')}</span>
          <input
            value={draft.place ?? ''}
            onChange={(event) => update({ place: event.target.value })}
          />
        </label>
        <label className="omi-reference-field-wide">
          <span>DOI</span>
          <input
            value={doi}
            onChange={(event) =>
              setDraft((current) =>
                setBibliographicIdentifier(current, 'doi', event.target.value),
              )
            }
          />
        </label>
        <label className="omi-reference-field-wide">
          <span>URL</span>
          <input
            type="url"
            value={draft.url ?? ''}
            onChange={(event) => update({ url: event.target.value })}
            placeholder="https://…"
          />
        </label>
      </div>

      {duplicateTitle ? (
        <div className="omi-reference-warning" role="alert">
          {t('citations.duplicateReference')} <strong>{duplicateTitle}</strong>
        </div>
      ) : null}

      <footer className="omi-reference-editor-actions">
        <button
          type="button"
          className="studio-menu-secondary-action"
          onClick={onDone}
        >
          {t('common.cancel')}
        </button>
        <button
          type="button"
          className="studio-menu-primary-action"
          disabled={!draft.title.trim()}
          onClick={save}
        >
          {t('common.save')}
        </button>
      </footer>
    </section>
  );
}

function referenceManagerRefreshCopy(locale: string) {
  const providerName = (provider: 'zotero' | 'mendeley') =>
    provider === 'zotero' ? 'Zotero' : 'Mendeley';

  if (locale === 'hu') {
    return {
      refreshFrom: (provider: 'zotero' | 'mendeley') =>
        `Frissítés innen: ${providerName(provider)}`,
      refreshing: 'Frissítés…',
      linkedTo: (provider: 'zotero' | 'mendeley') =>
        `Ez a rekord egy ${providerName(provider)}-rekordhoz kapcsolódik. A frissítés betölti a külső metaadatokat a szerkesztőbe; a módosítás csak a Mentés gombbal kerül a kéziratba.`,
      loaded: 'A külső rekord friss adatai betöltve. Ellenőrizd, majd mentsd a módosítást.',
      failed: 'A külső bibliográfiai rekord frissítése sikertelen.',
    };
  }
  if (locale === 'de') {
    return {
      refreshFrom: (provider: 'zotero' | 'mendeley') =>
        `Aus ${providerName(provider)} aktualisieren`,
      refreshing: 'Aktualisierung…',
      linkedTo: (provider: 'zotero' | 'mendeley') =>
        `Dieser Datensatz ist mit einem ${providerName(provider)}-Datensatz verknüpft. Die Aktualisierung lädt externe Metadaten in den Editor; erst Speichern übernimmt die Änderung ins Manuskript.`,
      loaded: 'Die aktuellen externen Daten wurden geladen. Prüfen und speichern Sie die Änderung.',
      failed: 'Der externe bibliografische Datensatz konnte nicht aktualisiert werden.',
    };
  }
  return {
    refreshFrom: (provider: 'zotero' | 'mendeley') =>
      `Refresh from ${providerName(provider)}`,
    refreshing: 'Refreshing…',
    linkedTo: (provider: 'zotero' | 'mendeley') =>
      `This record is linked to a ${providerName(provider)} record. Refresh loads external metadata into the editor; the manuscript changes only after Save.`,
    loaded: 'Fresh external metadata loaded. Review it, then save the change.',
    failed: 'The external bibliographic record could not be refreshed.',
  };
}

function cloneRecord(record: OmiBibliographicRecord): OmiBibliographicRecord {
  return JSON.parse(JSON.stringify(record)) as OmiBibliographicRecord;
}

function resourceTypeLabel(
  type: string,
  t: (key: AppTranslationKey) => string,
): string {
  return t(`citations.resourceTypes.${type}` as AppTranslationKey);
}
