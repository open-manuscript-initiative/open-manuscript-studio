import { useState } from 'react';
import { useTranslation } from '../i18n';
import { exchangeCopy } from '../i18n/exchange';
import { capabilityStatement, runModelAssessment, type ImplementationIdentity } from '../model/conformance';
import { getStudioPlatform } from '../mobile/platform/platform';
import { saveExportText } from '../services/exportFileDelivery';
import { BUILD_INFO } from '../version';

export function ModelSupportPanel() {
  const { locale } = useTranslation();
  const copy = exchangeCopy(locale);
  const [assessment, setAssessment] = useState<ReturnType<typeof runModelAssessment> | null>(null);
  const [error, setError] = useState('');
  const implementation: ImplementationIdentity = { name: 'Open Manuscript Studio', version: BUILD_INFO.version,
    build: BUILD_INFO.build, revision: BUILD_INFO.commit, dependencies: BUILD_INFO.dependencies };
  const platform = getStudioPlatform();
  const statement = capabilityStatement(implementation, platform);
  const labels: Record<string, string> = {
    'studio.collaboration.scoped-policy': copy.collaborationLabel,
    'studio.exchange.office-import': copy.importLabel,
    'studio.exchange.export-reports': copy.exportLabel,
    'studio.capabilities.disclosure': copy.capabilityLabel,
  };
  async function save(value: unknown, name: string) {
    try { setError(''); await saveExportText(JSON.stringify(value, null, 2), name, 'application/json;charset=utf-8'); }
    catch { setError(copy.unavailable); }
  }
  return <section className="panel omi-model-support" aria-labelledby="omi-capabilities-title">
    <h3 id="omi-capabilities-title">{copy.capabilities}</h3><p>{copy.disclosure}</p>
    <ul>{statement.capabilities.map((item) => <li key={item.id}>
      <strong>{item.specification}</strong> · {labels[item.id]} · {copy[item.status]}<p><code>{item.id}</code></p>
      <details><summary>{copy.limitation}</summary><ul>{[...item.prerequisites, ...item.limitations].map((text) => <li key={text}>{text}</li>)}</ul></details>
    </li>)}</ul>
    <p>{copy.scope}</p>
    <div className="studio-tool-actions">
      <button type="button" className="studio-menu-secondary-action" onClick={() => void save(statement, 'studio-capabilities.json')}>{copy.saveCapabilities}</button>
      <button type="button" className="studio-menu-secondary-action" onClick={() => setAssessment(runModelAssessment(implementation, platform))}>{copy.assess}</button>
      {assessment ? <button type="button" className="studio-menu-secondary-action" onClick={() => void save(assessment, 'studio-self-assessment.json')}>{copy.assessment}</button> : null}
    </div>
    <p role="status">{assessment ? copy[assessment.evidence.outcome] : copy.noEvidence}</p>
    {assessment ? <details><summary>{copy.events}</summary><ul>{assessment.evidence.results.map((result) => <li key={result.id}><code>{result.id}: {result.status}</code></li>)}</ul></details> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
