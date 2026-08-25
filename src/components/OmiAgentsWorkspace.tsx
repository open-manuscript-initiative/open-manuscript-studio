import { Bot, CheckCircle2, Clipboard, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import { buildStructuredTranslationPlan } from '../integrations/structuredExternalContent';
import type { BuiltInAgentId, ExternalDocumentScope } from '../services/integrationExecutionApi';
import { testIntegrationConnection } from '../services/integrationApi';
import { runOmiAgent } from '../services/omiAgentsApi';
import './OmiAgentsWorkspace.css';

type AgentScope = 'section' | 'manuscript' | 'metadata' | 'references';

export function OmiAgentsWorkspace() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const selectedSection = useMemo(
    () => manuscript.sections.find((section) => section.id === selectedSectionId) ?? manuscript.sections[0],
    [manuscript.sections, selectedSectionId],
  );

  const [agentId, setAgentId] = useState<BuiltInAgentId>('language-editor');
  const [scope, setScope] = useState<AgentScope>('section');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(false);
  const [ready, setReady] = useState<boolean | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [model, setModel] = useState('');
  const [copied, setCopied] = useState(false);

  async function checkReady(): Promise<boolean> {
    setChecking(true);
    setError('');
    try {
      const [agents, ai] = await Promise.all([
        testIntegrationConnection('omi-agents'),
        testIntegrationConnection('ai-provider'),
      ]);
      const isReady = Boolean(agents.healthy && ai.healthy);
      setReady(isReady);
      setStatusMessage(isReady ? copy.ready : agents.message ?? ai.message ?? copy.notReady);
      return isReady;
    } catch (reason) {
      setReady(false);
      setStatusMessage('');
      setError(reason instanceof Error ? reason.message : String(reason));
      return false;
    } finally {
      setChecking(false);
    }
  }

  function buildInput(): { scope: ExternalDocumentScope; content: string } | null {
    if (scope === 'metadata') {
      return {
        scope: { kind: 'metadata', id: manuscript.id },
        content: JSON.stringify({
          title: manuscript.title,
          subtitle: manuscript.subtitle,
          abstract: manuscript.abstract,
          keywords: manuscript.keywords,
        }, null, 2),
      };
    }

    if (scope === 'references') {
      return {
        scope: { kind: 'references', id: manuscript.id },
        content: JSON.stringify(manuscript.bibliographicRecords ?? [], null, 2),
      };
    }

    const documentScope: ExternalDocumentScope = scope === 'manuscript'
      ? { kind: 'manuscript', id: manuscript.id }
      : { kind: 'section', id: selectedSection?.id };
    const plan = buildStructuredTranslationPlan(manuscript, documentScope);
    if (!plan.segments.length) return null;
    return {
      scope: documentScope,
      content: plan.segments.map((segment) => segment.text).join('\n\n'),
    };
  }

  async function runAgent(): Promise<void> {
    const input = buildInput();
    if (!input?.content.trim()) {
      setError(copy.emptyScope);
      return;
    }

    setBusy(true);
    setError('');
    setSuggestion('');
    setCopied(false);
    try {
      if (ready !== true && !(await checkReady())) return;
      const requestedPermissions = agentId === 'metadata-assistant'
        ? ['metadata.read', 'suggest']
        : agentId === 'citation-checker'
          ? ['document.read', 'references.read', 'suggest']
          : ['document.read', 'suggest'];

      const result = await runOmiAgent({
        agentId,
        scope: input.scope,
        content: input.content,
        context: {
          manuscriptId: manuscript.id,
          locale: manuscript.locale,
          title: manuscript.title,
          sectionTitle: scope === 'section' ? selectedSection?.title ?? null : null,
          client: 'omi-studio',
        },
        requestedPermissions,
      });
      setSuggestion(result.suggestion);
      setModel(result.model ?? '');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function copySuggestion(): Promise<void> {
    if (!suggestion) return;
    await navigator.clipboard.writeText(suggestion);
    setCopied(true);
  }

  return (
    <section className="omi-agents-workspace" aria-labelledby="omi-agents-workspace-title">
      <header className="omi-agents-workspace__header">
        <div className="omi-agents-workspace__icon"><Bot size={22} aria-hidden="true" /></div>
        <div>
          <h3 id="omi-agents-workspace-title">OMI Agents</h3>
          <p>{copy.description}</p>
        </div>
      </header>

      <div className="omi-agents-workspace__safety">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>{copy.safety}</p>
      </div>

      <div className="omi-agents-workspace__status">
        <span className={`omi-agents-workspace__status-dot${ready === true ? ' is-ready' : ready === false ? ' is-error' : ''}`} aria-hidden="true" />
        <span>{statusMessage || copy.statusUnknown}</span>
        <button type="button" className="studio-menu-secondary-action" disabled={checking || busy} onClick={() => void checkReady()}>
          {checking ? copy.checking : copy.check}
        </button>
      </div>

      <div className="omi-agents-workspace__controls">
        <label>
          <span>{copy.agent}</span>
          <select value={agentId} onChange={(event) => setAgentId(event.target.value as BuiltInAgentId)}>
            <option value="language-editor">{copy.agents.languageEditor}</option>
            <option value="metadata-assistant">{copy.agents.metadataAssistant}</option>
            <option value="summarizer">{copy.agents.summarizer}</option>
            <option value="citation-checker">{copy.agents.citationChecker}</option>
          </select>
        </label>
        <label>
          <span>{copy.scope}</span>
          <select value={scope} onChange={(event) => setScope(event.target.value as AgentScope)}>
            <option value="section">{copy.scopes.section}</option>
            <option value="manuscript">{copy.scopes.manuscript}</option>
            <option value="metadata">{copy.scopes.metadata}</option>
            <option value="references">{copy.scopes.references}</option>
          </select>
        </label>
      </div>

      {scope === 'section' ? (
        <p className="omi-agents-workspace__context">{copy.currentSection}: <strong>{selectedSection?.title || copy.untitled}</strong></p>
      ) : null}

      <button type="button" className="studio-menu-primary-action omi-agents-workspace__run" disabled={busy || checking} onClick={() => void runAgent()}>
        <Sparkles size={17} aria-hidden="true" /> {busy ? copy.running : copy.run}
      </button>

      {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}

      {suggestion ? (
        <article className="omi-agents-workspace__result" aria-live="polite">
          <header>
            <div><strong>{copy.suggestion}</strong>{model ? <small>{copy.model}: {model}</small> : null}</div>
            <button type="button" className="omi-agents-workspace__dismiss" onClick={() => setSuggestion('')} aria-label={copy.dismiss}><X size={18} /></button>
          </header>
          <div className="omi-agents-workspace__suggestion">{suggestion}</div>
          <div className="omi-agents-workspace__result-actions">
            <button type="button" className="studio-menu-secondary-action" onClick={() => void copySuggestion()}>
              {copied ? <CheckCircle2 size={16} aria-hidden="true" /> : <Clipboard size={16} aria-hidden="true" />}
              {copied ? copy.copied : copy.copy}
            </button>
            <button type="button" className="studio-menu-secondary-action" onClick={() => setSuggestion('')}>{copy.reject}</button>
          </div>
          <p className="omi-agents-workspace__review-note">{copy.reviewNote}</p>
        </article>
      ) : null}
    </section>
  );
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    description: 'Az aktív kéziratot a Studio szerverén futó OMI agentekkel elemezheted. A mobilalkalmazás nem tárol AI API-kulcsot.',
    safety: 'Az agent eredménye javaslat. A kéziratot nem módosítja automatikusan; a szerző dönt a felhasználásáról.',
    statusUnknown: 'Kapcsolat még nincs ellenőrizve.', ready: 'OMI Agents használatra kész.', notReady: 'OMI Agents nincs használatra kész.',
    checking: 'Ellenőrzés…', check: 'Kapcsolat ellenőrzése', agent: 'Agent', scope: 'Hatókör', currentSection: 'Aktuális szakasz', untitled: 'Névtelen szakasz',
    run: 'Agent futtatása', running: 'Agent dolgozik…', emptyScope: 'A kiválasztott hatókörben nincs feldolgozható tartalom.',
    suggestion: 'Agent javaslata', model: 'Modell', copy: 'Másolás', copied: 'Másolva', reject: 'Elvetés', dismiss: 'Javaslat bezárása',
    reviewNote: 'A javaslat csak ellenőrzés után kerüljön a kéziratba.',
    agents: { languageEditor: 'Nyelvi szerkesztő', metadataAssistant: 'Metaadat-asszisztens', summarizer: 'Összefoglaló', citationChecker: 'Hivatkozás-ellenőrző' },
    scopes: { section: 'Aktuális szakasz', manuscript: 'Teljes kézirat', metadata: 'Metaadatok', references: 'Hivatkozások' },
  };
  if (locale === 'de') return {
    description: 'Analysiere das aktive Manuskript mit OMI Agents, die über den Studio-Server ausgeführt werden. Die mobile App speichert keinen AI-API-Schlüssel.',
    safety: 'Agent-Ergebnisse sind Vorschläge. Das Manuskript wird nicht automatisch geändert; die Autorin oder der Autor entscheidet über die Übernahme.',
    statusUnknown: 'Verbindung wurde noch nicht geprüft.', ready: 'OMI Agents ist einsatzbereit.', notReady: 'OMI Agents ist nicht einsatzbereit.',
    checking: 'Prüfen…', check: 'Verbindung prüfen', agent: 'Agent', scope: 'Bereich', currentSection: 'Aktueller Abschnitt', untitled: 'Unbenannter Abschnitt',
    run: 'Agent ausführen', running: 'Agent arbeitet…', emptyScope: 'Der ausgewählte Bereich enthält keinen verarbeitbaren Inhalt.',
    suggestion: 'Agent-Vorschlag', model: 'Modell', copy: 'Kopieren', copied: 'Kopiert', reject: 'Verwerfen', dismiss: 'Vorschlag schließen',
    reviewNote: 'Übernimm den Vorschlag erst nach eigener Prüfung in das Manuskript.',
    agents: { languageEditor: 'Sprachredaktion', metadataAssistant: 'Metadaten-Assistent', summarizer: 'Zusammenfassung', citationChecker: 'Zitationsprüfung' },
    scopes: { section: 'Aktueller Abschnitt', manuscript: 'Gesamtes Manuskript', metadata: 'Metadaten', references: 'Literaturangaben' },
  };
  return {
    description: 'Analyse the active manuscript with OMI Agents executed through the Studio server. The mobile app never stores the AI provider API key.',
    safety: 'Agent output is a suggestion. It never changes the manuscript automatically; the author decides whether to use it.',
    statusUnknown: 'Connection has not been checked yet.', ready: 'OMI Agents is ready.', notReady: 'OMI Agents is not ready.',
    checking: 'Checking…', check: 'Check connection', agent: 'Agent', scope: 'Scope', currentSection: 'Current section', untitled: 'Untitled section',
    run: 'Run agent', running: 'Agent is working…', emptyScope: 'The selected scope contains no content that the agent can process.',
    suggestion: 'Agent suggestion', model: 'Model', copy: 'Copy', copied: 'Copied', reject: 'Dismiss', dismiss: 'Close suggestion',
    reviewNote: 'Review the suggestion before incorporating it into the manuscript.',
    agents: { languageEditor: 'Language editor', metadataAssistant: 'Metadata assistant', summarizer: 'Summarizer', citationChecker: 'Citation checker' },
    scopes: { section: 'Current section', manuscript: 'Whole manuscript', metadata: 'Metadata', references: 'References' },
  };
}
