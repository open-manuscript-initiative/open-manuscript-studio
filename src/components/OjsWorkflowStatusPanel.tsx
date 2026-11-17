import { useEffect, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { applyOjsMetadataImport } from '../app/ojsMetadataActions';
import { useTranslation } from '../i18n';
import {
  getAgentDisplayName,
  getExternalIdentifierValue,
} from '../model/identity';
import {
  OJS_RECONCILIATION_FIELDS,
  canRepresentMetadataField,
  localMetadataValue,
  remoteMetadataValue,
  metadataEqual,
  exportOjsMetadata,
  type MetadataValue,
} from '../model/ojsMetadataReconciliation';
import { requestOjsMetadata } from '../services/integrationApi';
import type {
  OjsMetadataSnapshot,
  OjsPullMetadataField,
  OjsWritableMetadataField,
} from '../services/ojsMetadataTypes';

type Direction = 'keep' | 'pull' | 'push';
export function OjsWorkflowStatusPanel({
  connectionId,
  submissionId,
}: {
  connectionId: string;
  submissionId: number;
}) {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((state) => state.manuscript);
  const copy = locale === 'hu' ? hu : locale === 'de' ? de : en;
  const [snapshot, setSnapshot] = useState<OjsMetadataSnapshot | null>(null);
  const [language, setLanguage] = useState('');
  const [choices, setChoices] = useState<
    Partial<Record<OjsPullMetadataField, Direction>>
  >({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => {
    setSnapshot(null);
    setChoices({});
    setMessage('');
    setError('');
  }, [connectionId, submissionId]);
  useEffect(() => {
    setChoices({});
  }, [manuscript]);
  async function refresh() {
    const result = await requestOjsMetadata(connectionId, {
      action: 'inspect',
      submissionId,
    });
    setSnapshot(result.snapshot);
    setChoices({});
    setLanguage((current) =>
      result.snapshot.locales.includes(current)
        ? current
        : result.snapshot.locales.includes(manuscript.locale)
          ? manuscript.locale
          : result.snapshot.locales[0],
    );
    return result.snapshot;
  }
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  const selected = (direction: Direction) =>
    OJS_RECONCILIATION_FIELDS.filter((field) => choices[field] === direction);
  async function pull() {
    if (!snapshot) return;
    const source = useStudioStore.getState().manuscript;
    const fields = selected('pull');
    const latest = await requestOjsMetadata(connectionId, {
      action: 'inspect',
      submissionId,
    });
    if (latest.snapshot.stateToken !== snapshot.stateToken) {
      setSnapshot(latest.snapshot);
      setChoices({});
      throw new Error(copy.changed);
    }
    applyOjsMetadataImport(source, latest.snapshot, language, fields);
    setChoices({});
    setMessage(copy.imported);
  }
  async function push() {
    if (!snapshot) return;
    useStudioStore.getState().checkpoint('manual');
    const source = useStudioStore.getState().manuscript;
    const fields = exportOjsMetadata(
      source,
      snapshot,
      language,
      selected('push') as OjsWritableMetadataField[],
    );
    try {
      const result = await requestOjsMetadata(connectionId, {
        action: 'apply',
        submissionId,
        publicationId: snapshot.publicationId,
        locale: language,
        expectedStateToken: snapshot.stateToken,
        fields,
        confirmed: true,
      });
      setSnapshot(result.snapshot);
      setChoices({});
      setMessage(copy.exported);
    } catch (reason) {
      // A lost response is an uncertain write. Never automatically replay the old proposal.
      setChoices({});
      await refresh().catch(() => setSnapshot(null));
      throw reason;
    }
  }
  const contributorLines = manuscript.contributions
    .filter(
      (item) =>
        item.targetId === manuscript.id && item.roles.includes('author'),
    )
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((item) => {
      const agent = manuscript.agents.find(
        (candidate) => candidate.id === item.agentId,
      );
      return agent
        ? `${getAgentDisplayName(agent)}${getExternalIdentifierValue(agent, 'orcid') ? ` · ${getExternalIdentifierValue(agent, 'orcid')}` : ''}`
        : '';
    })
    .filter(Boolean);
  const display = (value: MetadataValue | null) =>
    value === undefined || value === null
      ? '—'
      : Array.isArray(value)
        ? value.join('; ')
        : String(value) || '∅';
  return (
    <section
      className="studio-settings-card publication-profile-options"
      aria-label={copy.title}
    >
      <h4>{copy.title}</h4>
      <p>{copy.help}</p>
      <button
        type="button"
        className="studio-menu-secondary-action"
        disabled={busy}
        onClick={() =>
          void run(async () => {
            await refresh();
          })
        }
      >
        {copy.refresh}
      </button>
      {snapshot ? (
        <>
          <p>
            {copy.stage}:{' '}
            {copy.stages[snapshot.stage as keyof typeof copy.stages] ??
              snapshot.stage}{' '}
            · {copy.version} {snapshot.publicationId}
          </p>
          <label>
            {copy.language}
            <select
              value={language}
              disabled={busy}
              onChange={(event) => {
                setLanguage(event.target.value);
                setChoices({});
              }}
            >
              {snapshot.locales.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <p>{copy.plainText}</p>
          <div style={{ overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>{copy.field}</th>
                  <th>OJS</th>
                  <th>OMI</th>
                  <th>{copy.direction}</th>
                </tr>
              </thead>
              <tbody>
                {OJS_RECONCILIATION_FIELDS.map((field) => {
                  let remote: MetadataValue;
                  let local: MetadataValue;
                  let comparisonError = '';
                  try {
                    remote = remoteMetadataValue(snapshot, language, field);
                    local = localMetadataValue(manuscript, language, field);
                  } catch (reason) {
                    comparisonError =
                      reason instanceof Error ? reason.message : String(reason);
                  }
                  const supported = canRepresentMetadataField(
                    field,
                    manuscript,
                    language,
                  );
                  const equal = supported && metadataEqual(remote, local);
                  return (
                    <tr key={field}>
                      <th>{copy.fields[field]}</th>
                      <td
                        style={{
                          whiteSpace: 'pre-wrap',
                          maxWidth: '24rem',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {comparisonError || display(remote)}
                      </td>
                      <td
                        style={{
                          whiteSpace: 'pre-wrap',
                          maxWidth: '24rem',
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {supported ? display(local) : copy.primaryOnly}
                      </td>
                      <td>
                        <select
                          aria-label={`${copy.direction}: ${copy.fields[field]}`}
                          value={choices[field] ?? 'keep'}
                          disabled={
                            busy ||
                            equal ||
                            !supported ||
                            Boolean(comparisonError)
                          }
                          onChange={(event) =>
                            setChoices((current) => ({
                              ...current,
                              [field]: event.target.value as Direction,
                            }))
                          }
                        >
                          <option value="keep">
                            {equal ? copy.same : copy.keep}
                          </option>
                          <option value="pull" disabled={remote === undefined}>
                            {copy.pull}
                          </option>
                          <option
                            value="push"
                            disabled={
                              !snapshot.writableFields.includes(
                                field as OjsWritableMetadataField,
                              ) || local === undefined
                            }
                          >
                            {copy.push}
                          </option>
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p>{copy.explicit}</p>
          <div className="publication-profile-actions">
            <button
              type="button"
              className="studio-menu-secondary-action"
              disabled={busy || !selected('pull').length}
              onClick={() => void run(pull)}
            >
              {copy.importButton}
            </button>
            <button
              type="button"
              className="studio-menu-primary-action"
              disabled={busy || !selected('push').length}
              onClick={() => void run(push)}
            >
              {copy.exportButton}
            </button>
          </div>
          <details>
            <summary>{copy.readOnly}</summary>
            <p>{copy.identities}</p>
            <table>
              <thead>
                <tr>
                  <th>{copy.field}</th>
                  <th>OJS</th>
                  <th>OMI</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th>DOI</th>
                  <td>{snapshot.metadata.doi ?? '—'}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th>{copy.pages}</th>
                  <td>{snapshot.metadata.pages ?? '—'}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th>{copy.issue}</th>
                  <td>{snapshot.metadata.issueId ?? '—'}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th>{copy.date}</th>
                  <td>{snapshot.metadata.datePublished ?? '—'}</td>
                  <td>—</td>
                </tr>
                <tr>
                  <th>{copy.contributors}</th>
                  <td>
                    {snapshot.contributors.map((item) => (
                      <p key={item.externalId}>
                        {item.externalId}: {item.name.given} {item.name.family}
                        {item.identifiers?.find((id) => id.scheme === 'orcid')
                          ?.value
                          ? ` · ${item.identifiers.find((id) => id.scheme === 'orcid')!.value}`
                          : ''}
                        {item.affiliation ? ` · ${item.affiliation}` : ''}
                      </p>
                    ))}
                  </td>
                  <td>
                    {contributorLines.map((line, index) => (
                      <p key={index}>{line}</p>
                    ))}
                  </td>
                </tr>
              </tbody>
            </table>
            <details>
              <summary>{copy.references}</summary>
              <pre style={{ whiteSpace: 'pre-wrap' }}>
                {snapshot.metadata.references || '—'}
              </pre>
            </details>
          </details>
        </>
      ) : null}
      {message ? <p role="status">{message}</p> : null}
      {error ? (
        <p role="alert" className="publication-profile-error">
          {error}
        </p>
      ) : null}
    </section>
  );
}
const en = {
  title: 'OJS metadata reconciliation',
  help: 'Compare exact language variants and choose each transfer direction. OJS remains the publishing authority.',
  refresh: 'Compare with OJS',
  stage: 'Stage',
  version: 'publication',
  language: 'Metadata language',
  field: 'Field',
  direction: 'Direction',
  plainText:
    'Abstracts are compared as plain text. Sending an abstract replaces its formatting in this language; other languages are preserved.',
  primaryOnly: 'Title/subtitle is available only in the manuscript language.',
  keep: 'Keep both',
  same: 'Same',
  pull: 'OJS → OMI',
  push: 'OMI → OJS',
  explicit:
    'Only fields with a selected direction are transferred. Each button applies its own direction.',
  importButton: 'Import selected fields into OMI',
  exportButton: 'Send selected fields to OJS',
  imported: 'Selected OJS fields were imported as a new OMI revision.',
  exported:
    'OJS confirmed the selected metadata changes. Inspect the artifact destination again before transferring files.',
  changed:
    'OJS metadata changed. Review the refreshed comparison and select fields again.',
  readOnly: 'Publication data and contributor identities',
  identities:
    'Contributor IDs, ORCID, DOI and issue/date data are not rewritten here. Manage these identities and publication assignments in their authoritative system.',
  pages: 'Pages',
  issue: 'Issue ID',
  date: 'Publication date',
  contributors: 'Contributors (ordered)',
  references: 'OJS references',
  fields: {
    title: 'Title',
    subtitle: 'Subtitle',
    abstract: 'Abstract',
    keywords: 'Keywords',
    licenseUrl: 'License URL',
    copyrightHolder: 'Copyright holder',
    copyrightYear: 'Copyright year',
  },
  stages: {
    submission: 'Submission',
    'internal-review': 'Internal review',
    review: 'Peer review',
    copyediting: 'Copyediting',
    production: 'Production',
  },
};
const hu: typeof en = {
  title: 'OJS–OMI metaadat-egyeztetés',
  help: 'Hasonlítsa össze a pontos nyelvi változatokat, és mezőnként válassza ki az átvétel irányát. A publikálási folyamatot továbbra is az OJS kezeli.',
  refresh: 'Összehasonlítás az OJS-sel',
  stage: 'Munkafázis',
  version: 'publikációváltozat',
  language: 'Metaadat nyelve',
  field: 'Adat',
  direction: 'Átvétel iránya',
  plainText:
    'Az absztraktot egyszerű szövegként hasonlítjuk össze. Beküldése lecseréli ennek a nyelvnek az absztraktformázását; a többi nyelv megmarad.',
  primaryOnly: 'Cím és alcím csak a kézirat nyelvén érhető el.',
  keep: 'Mindkettő megtartása',
  same: 'Azonos',
  pull: 'OJS → OMI',
  push: 'OMI → OJS',
  explicit:
    'Csak a kiválasztott irányú mezők kerülnek át. A két gomb külön-külön hajtja végre a két irányt.',
  importButton: 'Kiválasztott adatok átvétele az OMI-ba',
  exportButton: 'Kiválasztott adatok átadása az OJS-nek',
  imported: 'A kiválasztott OJS-adatok új OMI-változatba kerültek.',
  exported:
    'Az OJS visszaigazolta a kiválasztott metaadatok módosítását. Fájlátadás előtt ellenőrizze újra az átadás célját.',
  changed:
    'Az OJS metaadatai megváltoztak. Ellenőrizze az új összehasonlítást, majd válassza ki ismét a mezőket.',
  readOnly: 'Megjelenési adatok és szerzői azonosítók',
  identities:
    'A szerzői azonosítókat, ORCID-ot, DOI-t, valamint a folyóiratszámot és dátumot itt nem írjuk át. Ezeket a hiteles nyilvántartó rendszerben kell kezelni.',
  pages: 'Oldalszámok',
  issue: 'Folyóiratszám azonosítója',
  date: 'Megjelenés dátuma',
  contributors: 'Szerzők (sorrendben)',
  references: 'OJS-irodalomjegyzék',
  fields: {
    title: 'Cím',
    subtitle: 'Alcím',
    abstract: 'Absztrakt',
    keywords: 'Kulcsszavak',
    licenseUrl: 'Licenc URL-je',
    copyrightHolder: 'Szerzői jog jogosultja',
    copyrightYear: 'Szerzői jog éve',
  },
  stages: {
    submission: 'Beküldés',
    'internal-review': 'Belső bírálat',
    review: 'Tudományos bírálat',
    copyediting: 'Szöveggondozás',
    production: 'Kiadvány-előkészítés',
  },
};
const de: typeof en = {
  ...en,
  title: 'OJS–OMI-Metadatenabgleich',
  help: 'Exakte Sprachvarianten vergleichen und die Übertragungsrichtung je Feld wählen. OJS bleibt für den Publikationsworkflow maßgeblich.',
  refresh: 'Mit OJS vergleichen',
  stage: 'Phase',
  version: 'Publikationsversion',
  language: 'Metadatensprache',
  field: 'Feld',
  direction: 'Richtung',
  plainText:
    'Abstracts werden als Klartext verglichen. Eine Übertragung ersetzt die Formatierung dieser Sprachvariante; andere Sprachen bleiben erhalten.',
  primaryOnly:
    'Titel und Untertitel stehen nur in der Manuskriptsprache zur Verfügung.',
  keep: 'Beide behalten',
  same: 'Identisch',
  explicit:
    'Nur ausgewählte Felder werden übertragen. Jede Schaltfläche führt ihre eigene Richtung aus.',
  importButton: 'Ausgewählte Felder nach OMI übernehmen',
  exportButton: 'Ausgewählte Felder an OJS senden',
  imported:
    'Die ausgewählten OJS-Felder wurden als neue OMI-Revision übernommen.',
  exported:
    'OJS hat die ausgewählten Metadatenänderungen bestätigt. Vor der Dateiübertragung das Ziel erneut prüfen.',
  changed:
    'OJS-Metadaten wurden geändert. Den neuen Vergleich prüfen und die Felder erneut auswählen.',
  readOnly: 'Publikationsdaten und Autorenidentitäten',
  identities:
    'Autoren-IDs, ORCID, DOI sowie Ausgabe und Datum werden hier nicht überschrieben. Diese Daten im maßgeblichen System verwalten.',
  pages: 'Seiten',
  issue: 'Ausgaben-ID',
  date: 'Publikationsdatum',
  contributors: 'Mitwirkende (Reihenfolge)',
  references: 'OJS-Literaturverzeichnis',
  fields: {
    title: 'Titel',
    subtitle: 'Untertitel',
    abstract: 'Abstract',
    keywords: 'Schlagwörter',
    licenseUrl: 'Lizenz-URL',
    copyrightHolder: 'Urheberrechtsinhaber',
    copyrightYear: 'Urheberrechtsjahr',
  },
  stages: {
    submission: 'Einreichung',
    'internal-review': 'Interne Begutachtung',
    review: 'Begutachtung',
    copyediting: 'Lektorat',
    production: 'Produktion',
  },
};
