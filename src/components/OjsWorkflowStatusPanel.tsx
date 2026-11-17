import { useEffect, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { getStudioApiBaseUrl } from '../services/studioServer';
interface Snapshot {
  stateToken: string;
  stage: string;
  publicationId: number | null;
  publicationStatus: number | null;
  lastModified: string | null;
  metadata: {
    title?: Record<string, string>;
    abstract?: Record<string, string>;
    pages?: string;
    issueId?: number;
    datePublished?: string;
    licenseUrl?: string;
  };
}
export function OjsWorkflowStatusPanel({
  connectionId,
  submissionId,
}: {
  connectionId: string;
  submissionId: number;
}) {
  const { locale } = useTranslation();
  const manuscript = useStudioStore((s) => s.manuscript);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [changed, setChanged] = useState(false);
  const [checkedAt, setCheckedAt] = useState('');
  const copy = locale === 'hu' ? hu : locale === 'de' ? de : en;
  useEffect(() => {
    setSnapshot(null);
    setError('');
    setChanged(false);
    setCheckedAt('');
  }, [connectionId, submissionId]);
  async function refresh() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(
        `${getStudioApiBaseUrl()}/api/integrations/connections/${encodeURIComponent(connectionId)}/workflow-status`,
        {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submissionId }),
        },
      );
      const payload = await response.json();
      if (!response.ok)
        throw new Error(payload.error?.message ?? `HTTP ${response.status}`);
      const next = payload.snapshot as Snapshot;
      setChanged(Boolean(snapshot && snapshot.stateToken !== next.stateToken));
      setSnapshot(next);
      setCheckedAt(new Date().toLocaleString());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  const title =
    snapshot?.metadata.title?.[manuscript.locale] ??
    Object.values(snapshot?.metadata.title ?? {})[0] ??
    '';
  const stages: Record<string, string> = copy.stages;
  return (
    <section className="studio-settings-card" aria-label={copy.title}>
      <h4>{copy.title}</h4>
      <p>{copy.help}</p>
      <button type="button" disabled={busy} onClick={() => void refresh()}>
        {copy.refresh}
      </button>
      {snapshot ? (
        <>
          <p role="status">
            {stages[snapshot.stage] ?? snapshot.stage} · {copy.version}{' '}
            {snapshot.publicationId ?? '—'}
          </p>
          <p>
            <small>
              {copy.checked}: {checkedAt}
            </small>
          </p>
          {changed ? <p role="status">{copy.changed}</p> : null}
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
                <th>{copy.articleTitle}</th>
                <td>{title}</td>
                <td>
                  {manuscript.title}
                  {title !== manuscript.title ? ` · ${copy.different}` : ''}
                </td>
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
            </tbody>
          </table>
        </>
      ) : null}
      {error ? <p role="alert">{error}</p> : null}
    </section>
  );
}
const en = {
  title: 'Current OJS workflow',
  help: 'Read the authoritative stage and publication metadata from OJS. Compare differences before editing; this refresh does not overwrite either system.',
  refresh: 'Refresh from OJS',
  checked: 'Last checked',
  changed:
    'OJS changed since the previous refresh. Inspect the transfer target again.',
  version: 'publication',
  field: 'Field',
  articleTitle: 'Title',
  pages: 'Pages',
  issue: 'Issue ID',
  date: 'Publication date',
  different: 'differs',
  stages: {
    submission: 'Submission',
    'internal-review': 'Internal review',
    review: 'Peer review',
    copyediting: 'Copyediting',
    production: 'Production',
  },
};
const hu: typeof en = {
  title: 'Aktuális OJS-munkafolyamat',
  help: 'Az OJS hiteles állapotának és megjelenési adatainak lekérdezése. Eltérés esetén egyeztesse az adatokat; a frissítés egyik rendszer tartalmát sem írja felül.',
  refresh: 'Frissítés az OJS-ből',
  checked: 'Ellenőrzés időpontja',
  changed: 'Az OJS adatai megváltoztak. Ellenőrizze újra az átadás célját.',
  version: 'publikációváltozat',
  field: 'Adat',
  articleTitle: 'Cím',
  pages: 'Oldalszámok',
  issue: 'Folyóiratszám azonosítója',
  date: 'Megjelenés dátuma',
  different: 'eltér',
  stages: {
    submission: 'Beküldés',
    'internal-review': 'Belső bírálat',
    review: 'Tudományos bírálat',
    copyediting: 'Szöveggondozás',
    production: 'Kiadvány-előkészítés',
  },
};
const de: typeof en = {
  title: 'Aktueller OJS-Workflow',
  help: 'Maßgeblichen Status und Publikationsmetadaten aus OJS lesen. Unterschiede vor einer Bearbeitung abgleichen; kein automatisches Überschreiben.',
  refresh: 'Aus OJS aktualisieren',
  checked: 'Letzte Prüfung',
  changed: 'OJS wurde geändert. Das Übertragungsziel erneut prüfen.',
  version: 'Publikationsversion',
  field: 'Feld',
  articleTitle: 'Titel',
  pages: 'Seiten',
  issue: 'Ausgaben-ID',
  date: 'Publikationsdatum',
  different: 'abweichend',
  stages: {
    submission: 'Einreichung',
    'internal-review': 'Interne Begutachtung',
    review: 'Begutachtung',
    copyediting: 'Lektorat',
    production: 'Produktion',
  },
};
