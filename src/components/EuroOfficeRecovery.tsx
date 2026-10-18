import { useState } from 'react';
import { tCatalog } from '../i18n/translate';
import { downloadEuroOfficeSave, listEuroOfficeSaves, type EuroOfficeSaveSummary } from '../services/euroOfficeApi';
import { saveExportBlob } from '../services/exportFileDelivery';

/** Owner-only immutable snapshots; recovery downloads never silently replace the current head. */
export function EuroOfficeRecovery({ documentId }: { documentId: string }) {
  const [saves, setSaves] = useState<EuroOfficeSaveSummary[]>([]);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const copy = (key: string) => tCatalog(`/uncataloguedUi/euroOfficeRecovery/${key}`);
  async function load() {
    setBusy(true); setError(false);
    try { setSaves(await listEuroOfficeSaves(documentId)); } catch { setError(true); }
    finally { setBusy(false); }
  }
  async function download(id: string) {
    setError(false);
    try { await saveExportBlob(await downloadEuroOfficeSave(documentId, id), 'recovered-document.docx'); }
    catch { setError(true); }
  }
  return <details onToggle={event => { if (event.currentTarget.open) void load(); }}>
    <summary>{copy('title')}</summary>
    <p>{copy('description')}</p>
    {busy ? <p role="status">{copy('loading')}</p> : null}
    {!busy && saves.length === 0 ? <p>{copy('empty')}</p> : null}
    {saves.map(save => <button key={save.id} type="button" onClick={() => void download(save.id)}>
      {copy(save.applied ? 'final' : save.status === 0 ? 'previous' : 'recovery')} · {new Date(save.createdAt).toLocaleString()}
    </button>)}
    {error ? <p role="alert">{copy('failed')}</p> : null}
  </details>;
}
