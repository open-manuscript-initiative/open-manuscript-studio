import { useState } from 'react';
import { useTranslation } from '../i18n';
import { translatedCapabilityDetails } from '../i18n/capabilityDetails';
import { exchangeCopy } from '../i18n/exchange';
import { capabilityStatement, runModelAssessment, type ImplementationIdentity } from '../model/conformance';
import { getStudioPlatform } from '../mobile/platform/platform';
import { studioApiFetch } from '../platform/studioApiTransport';
import { saveExportText } from '../services/exportFileDelivery';
import { getStudioApiBaseUrl } from '../services/studioServer';
import {
  isRuntimeAssessmentCurrent,
  runRuntimeCapabilityAssessment,
  type RuntimeProbeId,
  type RuntimeAssessment,
} from '../services/runtimeCapabilityAssessment';
import { BUILD_INFO } from '../version';

const capabilityProbes: Record<string, RuntimeProbeId | undefined> = {
  'studio.collaboration.scoped-policy': 'collaboration-enabled',
  'studio.extensions.manifest-registry': 'extension-registry',
  'studio.api.integration-extensions': 'extension-api',
};

export function ModelSupportPanel() {
  const { locale } = useTranslation();
  const copy = exchangeCopy(locale);
  const [assessment, setAssessment] = useState<ReturnType<typeof runModelAssessment> | null>(null);
  const [runtime, setRuntime] = useState<RuntimeAssessment | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState('');
  const implementation: ImplementationIdentity = { name: 'Open Manuscript Studio', version: BUILD_INFO.version,
    build: BUILD_INFO.build, revision: BUILD_INFO.commit, dependencies: BUILD_INFO.dependencies };
  const platform = getStudioPlatform();
  const apiBase = getStudioApiBaseUrl();
  const serverOrigin = new URL(apiBase || '/', globalThis.location?.origin ?? 'https://studio.openmanuscript.org').origin;
  const currentRuntime = runtime && isRuntimeAssessmentCurrent(runtime, implementation, platform, serverOrigin) ? runtime : null;
  const statement = capabilityStatement(implementation, platform);
  const labels: Record<string, string> = {
    'studio.collaboration.scoped-policy': copy.collaborationLabel,
    'studio.exchange.office-import': copy.importLabel,
    'studio.exchange.export-reports': copy.exportLabel,
    'studio.capabilities.disclosure': copy.capabilityLabel,
    'studio.extensions.manifest-registry': copy.registryLabel,
    'studio.api.integration-extensions': copy.apiLabel,
  };
  const probeLabels: Record<RuntimeProbeId, string> = {
    'server-health': copy.liveServerHealth,
    'collaboration-enabled': copy.liveCollaboration,
    'extension-api': copy.liveExtensionApi,
    'extension-registry': copy.liveExtensionRegistry,
  };
  async function save(value: unknown, name: string) {
    try { setError(''); await saveExportText(JSON.stringify(value, null, 2), name, 'application/json;charset=utf-8'); }
    catch { setError(copy.unavailable); }
  }
  async function checkServer() {
    setChecking(true);
    setError('');
    setRuntime(null);
    try {
      const result = await runRuntimeCapabilityAssessment(implementation, platform, serverOrigin, studioApiFetch);
      setRuntime(result);
    } catch {
      setError(copy.liveNETWORK_ERROR);
    } finally {
      setChecking(false);
    }
  }
  return <section className="panel omi-model-support" aria-labelledby="omi-capabilities-title">
    <h3 id="omi-capabilities-title">{copy.capabilities}</h3><p>{copy.disclosure}</p>
    <ul>{statement.capabilities.map((item) => {
      const details = translatedCapabilityDetails(locale, item);
      const probeId = capabilityProbes[item.id];
      const live = probeId ? currentRuntime?.probes.find((entry) => entry.id === probeId) : undefined;
      return <li key={item.id}>
        <strong>{item.specification}</strong> · {labels[item.id] ?? item.id} · {copy.liveDeclared}: {copy[item.status]}
        {live ? <p>{probeLabels[live.id]}: <strong>{live.status === 'pass' ? copy.livePass :
          live.status === 'fail' ? copy.liveFail : copy.liveUnavailable}</strong> · {copy[`live${live.code}`]}</p> : null}
        <p><code>{item.id}</code></p>
        <details><summary>{copy.limitation}</summary><ul>{[...details.prerequisites, ...details.limitations].map((text, index) => <li key={index}>{text}</li>)}</ul></details>
      </li>;
    })}</ul>
    <p>{copy.liveScope}</p>
    <div className="studio-tool-actions">
      <button type="button" className="studio-menu-secondary-action" disabled={checking} onClick={() => void checkServer()}>
        {checking ? copy.liveRunning : copy.liveRun}
      </button>
      <button type="button" className="studio-menu-secondary-action" disabled={!currentRuntime || checking}
        onClick={() => currentRuntime && void save(currentRuntime, 'studio-runtime-capabilities.json')}>{copy.liveSave}</button>
      <button type="button" className="studio-menu-secondary-action" onClick={() => void save(statement, 'studio-capabilities.json')}>{copy.saveCapabilities}</button>
    </div>
    {runtime && !currentRuntime ? <p>{copy.liveStale}</p> : null}
    {currentRuntime ? <>
      <p><time dateTime={currentRuntime.checkedAt}>{new Date(currentRuntime.checkedAt).toLocaleString(locale)}</time> · {currentRuntime.serverOrigin}</p>
      <details><summary>{copy.events}</summary><ul>{currentRuntime.probes.map((item) =>
        <li key={item.id}>{probeLabels[item.id]}: <strong>{item.status === 'pass' ? copy.livePass :
          item.status === 'fail' ? copy.liveFail : copy.liveUnavailable}</strong> — {copy[`live${item.code}`]}
          {item.httpStatus ? ` (HTTP ${item.httpStatus})` : ''}</li>)}</ul></details>
      <p>{copy.liveNotCertified}</p>
    </> : <p>{copy.liveEmpty}</p>}
    <p>{copy.scope}</p>
    <div className="studio-tool-actions">
      <button type="button" className="studio-menu-secondary-action" onClick={() => setAssessment(runModelAssessment(implementation, platform))}>{copy.assess}</button>
      {assessment ? <button type="button" className="studio-menu-secondary-action" onClick={() => void save(assessment, 'studio-self-assessment.json')}>{copy.assessment}</button> : null}
    </div>
    <p role="status">{assessment ? copy[assessment.evidence.outcome] : copy.noEvidence}</p>
    {assessment ? <details><summary>{copy.events}</summary><ul>{assessment.evidence.results.map((result) => <li key={result.id}><code>{result.id}: {result.status}</code></li>)}</ul></details> : null}
    {error ? <p role="alert">{error}</p> : null}
  </section>;
}
