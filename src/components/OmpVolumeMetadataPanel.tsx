import { useEffect, useRef, useState } from 'react';
import { useStudioStore } from '../app/useStudioStore';
import { applyOjsMetadataImport } from '../app/ojsMetadataActions';
import { useTranslation } from '../i18n';
import { ompVolumeMetadataTarget } from '../model/ompVolumeMetadataTarget';
import { canRepresentMetadataField, exportOjsMetadata, localMetadataValue, remoteMetadataValue, metadataEqual, type MetadataValue } from '../model/ojsMetadataReconciliation';
import { getEditorialConnectorCapabilities, requestOmpVolumeMetadata, type IntegrationConnection } from '../services/integrationApi';
import { getStudioApiBaseUrl } from '../services/studioServer';
import type { OmpMetadataSnapshot } from '../../server/src/contracts/ompMetadataContract';
import type { OjsWritableMetadataField } from '../services/ojsMetadataTypes';

const fields: OjsWritableMetadataField[] = ['title', 'subtitle', 'abstract', 'keywords'];
const labels = {
  hu: { title: 'OMP–OMI kötet-metaadatok egyeztetése', help: 'Csak a kiválasztott nyelvi mezők változnak. A fejezetek, DOI, ISBN és sorozat érintetlen marad. Az absztrakt egyszerű szövegként kerül át.', connection: 'OMP-kapcsolat', choose: 'Válasszon', inspect: 'Összehasonlítás', language: 'Nyelv', field: 'Mező', names: ['Cím', 'Alcím', 'Absztrakt', 'Kulcsszavak'], keep: 'Megőrzés', pull: 'OMP → OMI', push: 'OMI → OMP', read: 'Átvétel az OMI-ba', write: 'Átadás az OMP-be', confirm: 'Jóváhagyom a kiválasztott módosításokat', stale: 'A dokumentum, kapcsolat vagy metaadat megváltozott. Ellenőrizze újra.', uncertain: 'Ellenőrizze az előző írást az OMP-ben. Nincs automatikus ismétlés.', done: 'A kiválasztott mezők egyeztetve.', series: 'Sorozat', stage: 'Munkafázis', unsupported: 'Ez az OMP-kapcsolat nem támogatja a kötet metaadatainak egyeztetését. Frissítse az OMP-integrációs bővítményt.' },
  en: { title: 'OMP–OMI volume metadata reconciliation', help: 'Only selected volume fields in the chosen language change. Chapters, DOI, ISBN and series are untouched. Abstracts transfer as plain text.', connection: 'OMP connection', choose: 'Choose', inspect: 'Compare', language: 'Language', field: 'Field', names: ['Title', 'Subtitle', 'Abstract', 'Keywords'], keep: 'Keep both', pull: 'OMP → OMI', push: 'OMI → OMP', read: 'Import into OMI', write: 'Send to OMP', confirm: 'I approve the selected changes', stale: 'Document, connection or metadata changed. Inspect again.', uncertain: 'Inspect the previous write in OMP. No automatic retry.', done: 'Selected fields reconciled.', series: 'Series', stage: 'Stage', unsupported: 'This OMP connection does not support volume metadata reconciliation. Update the OMP integration plugin.' },
  de: { title: 'OMP–OMI Bandmetadatenabgleich', help: 'Nur ausgewählte Bandfelder der gewählten Sprache ändern sich. Kapitel, DOI, ISBN und Reihe bleiben unverändert. Abstracts werden als Klartext übertragen.', connection: 'OMP-Verbindung', choose: 'Auswählen', inspect: 'Vergleichen', language: 'Sprache', field: 'Feld', names: ['Titel', 'Untertitel', 'Abstract', 'Schlagwörter'], keep: 'Beide behalten', pull: 'OMP → OMI', push: 'OMI → OMP', read: 'Nach OMI übernehmen', write: 'An OMP senden', confirm: 'Ausgewählte Änderungen bestätigen', stale: 'Dokument, Verbindung oder Metadaten geändert. Erneut prüfen.', uncertain: 'Vorherige Übertragung in OMP prüfen. Keine automatische Wiederholung.', done: 'Ausgewählte Felder abgeglichen.', series: 'Reihe', stage: 'Phase', unsupported: 'Diese OMP-Verbindung unterstützt den Bandmetadatenabgleich nicht. Das OMP-Integrationsplugin aktualisieren.' },
};
type Direction = 'keep' | 'pull' | 'push';
export function OmpVolumeMetadataPanel({ connections, disabled }: { connections: readonly IntegrationConnection[]; disabled: boolean }) {
  const { locale } = useTranslation();
  const copy = labels[locale.split(/[-_]/)[0] as keyof typeof labels] ?? labels.en;
  const source = useStudioStore(state => state.manuscript);
  const target = ompVolumeMetadataTarget(source);
  const [connection, setConnection] = useState('');
  const [language, setLanguage] = useState('');
  const [inspection, setInspection] = useState<{ source: typeof source; connection: string; server: string; snapshot: OmpMetadataSnapshot }>();
  const [choices, setChoices] = useState<Partial<Record<OjsWritableMetadataField, Direction>>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const lock = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const latest = useRef({ connection, connections, disabled });
  latest.current = { connection, connections, disabled };
  const assertCurrent = (candidate: { source: typeof source; connection: string; server: string }) => {
    if (!mounted.current || latest.current.disabled || useStudioStore.getState().manuscript !== candidate.source ||
        latest.current.connection !== candidate.connection || getStudioApiBaseUrl() !== candidate.server ||
        !latest.current.connections.some(item => item.enabled && item.providerId === 'omp' && item.id === candidate.connection)) throw new Error(copy.stale);
  };
  const snapshot = inspection && inspection.source === source && inspection.connection === connection && inspection.server === getStudioApiBaseUrl() ? inspection.snapshot : undefined;
  const selected = (direction: Direction) => fields.filter(field => choices[field] === direction);
  async function run(action: 'inspect' | 'pull' | 'push') {
    if (lock.current || disabled || !target || !connection) return;
    lock.current = true; setBusy(true); setError(''); setMessage('');
    let attempted = false;
    const candidate = { source, connection, server: getStudioApiBaseUrl() };
    try {
      assertCurrent(candidate);
      const capabilities = await getEditorialConnectorCapabilities(connection);
      assertCurrent(candidate);
      if (capabilities.provider !== 'omp' || capabilities.authority !== 'OMP' || !capabilities.features.metadataReconcile)
        throw new Error(copy.unsupported);
      const fresh = await requestOmpVolumeMetadata(connection, { ...target, action: 'inspect' });
      assertCurrent(candidate);
      if (action === 'inspect') {
        setInspection({ ...candidate, snapshot: fresh.snapshot });
        setLanguage(fresh.snapshot.locales.includes(source.locale) ? source.locale : fresh.snapshot.locales[0]!);
        setChoices({}); setConfirmed(false); return;
      }
      if (!snapshot || !confirmed || fresh.snapshot.stateToken !== snapshot.stateToken) throw new Error(copy.stale);
      const chosen = selected(action);
      if (!chosen.length) return;
      if (action === 'pull') applyOjsMetadataImport(source, fresh.snapshot, language, chosen);
      else {
        const proposal = exportOjsMetadata(source, fresh.snapshot, language, chosen);
        assertCurrent(candidate);
        attempted = true;
        await requestOmpVolumeMetadata(connection, { ...target, action: 'apply', locale: language, fields: proposal, confirmed: true, expectedStateToken: snapshot.stateToken });
        assertCurrent(candidate);
      }
      setMessage(copy.done);
    } catch (cause) { setError((cause instanceof Error ? cause.message : String(cause)) + (attempted ? ' ' + copy.uncertain : '')); }
    finally { if (action !== 'inspect') { setInspection(undefined); setChoices({}); setConfirmed(false); } lock.current = false; setBusy(false); }
  }
  if (!target) return null;
  return <section className="studio-settings-card publication-profile-options" aria-label={copy.title}>
    <h4>{copy.title}</h4><p>{copy.help}</p>
    <fieldset disabled={busy || disabled}>
      <label>{copy.connection}<select value={connection} onChange={event => { setConnection(event.target.value); setInspection(undefined); setChoices({}); setConfirmed(false); }}>
        <option value="">{copy.choose}</option>{connections.filter(item => item.enabled && item.providerId === 'omp').map(item => <option key={item.id} value={item.id}>{item.displayName ?? item.connectionKey}</option>)}
      </select></label>
      <button type="button" disabled={!connection} onClick={() => { setInspection(undefined); void run('inspect'); }}>{copy.inspect}</button>
      {snapshot ? <>
        <p>{copy.stage}: {snapshot.stage} · #{snapshot.publicationId} · {copy.series}: {snapshot.metadata.seriesId ?? '—'} · {snapshot.metadata.seriesPosition ?? '—'}</p>
        <label>{copy.language}<select value={language} onChange={event => { setLanguage(event.target.value); setChoices({}); setConfirmed(false); }}>{snapshot.locales.map(item => <option key={item}>{item}</option>)}</select></label>
        <div style={{ overflowX: 'auto' }}><table><thead><tr><th>{copy.field}</th><th>OMP</th><th>OMI</th><th>{copy.choose}</th></tr></thead><tbody>
        {fields.map((field, index) => {
          const supported = canRepresentMetadataField(field, source, language);
          let remote: MetadataValue, local: MetadataValue, failure = '';
          try { remote = remoteMetadataValue(snapshot, language, field); local = localMetadataValue(source, language, field); }
          catch (cause) { failure = String(cause); }
          const display = (value: unknown) => Array.isArray(value) ? value.join('; ') : String(value ?? '—');
          return <tr key={field}><th>{copy.names[index]}</th><td>{failure || display(remote)}</td><td>{display(local)}</td>
            <td><select aria-label={copy.names[index]} value={choices[field] ?? 'keep'} disabled={!supported || !!failure || metadataEqual(remote, local)} onChange={event => { setChoices(previous => ({ ...previous, [field]: event.target.value as Direction })); setConfirmed(false); }}>
              <option value="keep">{copy.keep}</option><option value="pull" disabled={remote === undefined}>{copy.pull}</option><option value="push" disabled={local === undefined || !snapshot.writableFields.includes(field)}>{copy.push}</option>
            </select></td></tr>;
        })}
        </tbody></table></div>
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} />{copy.confirm}</label>
        <button type="button" disabled={!confirmed || !selected('pull').length} onClick={() => void run('pull')}>{copy.read}</button>
        <button type="button" disabled={!confirmed || !selected('push').length} onClick={() => void run('push')}>{copy.write}</button>
      </> : inspection ? <p role="alert">{copy.stale}</p> : null}
    </fieldset>
    {message ? <p role="status">{message}</p> : null}{error ? <p role="alert">{error}</p> : null}
  </section>;
}
