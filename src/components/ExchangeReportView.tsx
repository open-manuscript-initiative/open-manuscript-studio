import { useState } from 'react';
import { useTranslation } from '../i18n';
import { exchangeCopy } from '../i18n/exchange';
import type { ExchangeReport } from '../model/exchange';
import { saveExportBlob, saveExportText } from '../services/exportFileDelivery';

export function ExchangeReportView({ report, original }: { report: ExchangeReport; original?: File }) {
  const { locale } = useTranslation();
  const copy = exchangeCopy(locale);
  const [error, setError] = useState('');
  async function save(originalFile = false) {
    try {
      setError('');
      if (originalFile && original) await saveExportBlob(original, original.name);
      else await saveExportText(JSON.stringify(report, null, 2), `exchange-${report.id}.json`, 'application/json;charset=utf-8');
    } catch { setError(copy.unavailable); }
  }
  return <section className="studio-settings-hint omi-exchange-report" aria-label={copy.title}>
    <h4>{copy.title}</h4><p role="status">{copy[report.status]}</p>
    <p>{copy.incomplete}</p>
    {report.status === 'prepared' ? <p>{copy.review}</p> : null}
    <details><summary>{copy.events} ({report.events.length})</summary>
      <ul>{report.events.map((event, index) => <li key={index}><code>{event.code}</code> · {event.disposition}<p>{event.consequence}</p><code>{event.sourceLocator}</code></li>)}</ul>
      <p><code>{report.mapping.id}@{report.mapping.version}</code></p>
      <ul>{report.mapping.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
    </details>
    <div className="studio-tool-actions">
      <button type="button" className="studio-menu-secondary-action" onClick={() => void save()}>{copy.export}</button>
      {original ? <button type="button" className="studio-menu-secondary-action" onClick={() => void save(true)}>{copy.original}</button> : null}
    </div>
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
