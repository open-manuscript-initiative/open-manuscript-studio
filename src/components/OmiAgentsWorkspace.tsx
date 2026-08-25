import { Bot, Check, CheckCircle2, ChevronLeft, ChevronRight, Clipboard, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import { useTranslation } from '../i18n';
import {
  applyStructuredTranslations,
  buildStructuredTranslationPlan,
} from '../integrations/structuredExternalContent';
import type {
  BuiltInAgentId,
  ExternalDocumentScope,
  TranslationSegment,
} from '../services/integrationExecutionApi';
import { testIntegrationConnection } from '../services/integrationApi';
import { recordOmiAgentReview, runOmiAgent } from '../services/omiAgentsApi';
import './OmiAgentsWorkspace.css';

type AgentScope = 'section' | 'manuscript' | 'metadata' | 'references';

type StructuredProposal = {
  segmentId: string;
  blockId: string;
  originalText: string;
  proposedText: string;
  reason?: string;
  model?: string;
  auditId: string;
};

const STRUCTURED_BATCH_CHARACTERS = 42_000;

export function OmiAgentsWorkspace() {
  const { locale } = useTranslation();
  const copy = getCopy(locale);
  const manuscript = useStudioStore((state) => state.manuscript);
  const updateBlock = useStudioStore((state) => state.updateBlock);
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
  const [proposals, setProposals] = useState<StructuredProposal[]>([]);
  const [proposalIndex, setProposalIndex] = useState(0);
  const [progress, setProgress] = useState('');

  const currentProposal = proposals[proposalIndex];

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

  function buildLanguageEditingPlan(): { scope: ExternalDocumentScope; segments: TranslationSegment[] } | null {
    if (scope !== 'section' && scope !== 'manuscript') return null;
    const documentScope: ExternalDocumentScope = scope === 'manuscript'
      ? { kind: 'manuscript', id: manuscript.id }
      : { kind: 'section', id: selectedSection?.id };
    const plan = buildStructuredTranslationPlan(manuscript, documentScope);
    const segments = plan.segments.filter((segment) =>
      (segment.id.startsWith('block:') || segment.id.startsWith('legacy:')) && segment.text.trim(),
    );
    return segments.length ? { scope: documentScope, segments } : null;
  }

  async function runAgent(): Promise<void> {
    setBusy(true);
    setError('');
    setSuggestion('');
    setProposals([]);
    setProposalIndex(0);
    setCopied(false);
    setProgress('');
    try {
      if (ready !== true && !(await checkReady())) return;

      if (agentId === 'language-editor') {
        const structuredPlan = buildLanguageEditingPlan();
        if (structuredPlan) {
          await runStructuredLanguageEditor(structuredPlan.scope, structuredPlan.segments);
          return;
        }
      }

      const input = buildInput();
      if (!input?.content.trim()) {
        setError(copy.emptyScope);
        return;
      }
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
      setProgress('');
    }
  }

  async function runStructuredLanguageEditor(
    documentScope: ExternalDocumentScope,
    segments: TranslationSegment[],
  ): Promise<void> {
    const batches = createSegmentBatches(segments);
    const collected: StructuredProposal[] = [];

    for (let index = 0; index < batches.length; index += 1) {
      setProgress(copy.progress(index + 1, batches.length));
      const batch = batches[index]!;
      const requestBody = JSON.stringify({
        task: 'Edit each scholarly text segment independently. Preserve meaning, names, quotations, citation markers and factual claims. Return only valid JSON, with no Markdown fences.',
        outputSchema: {
          suggestions: [{ segmentId: 'exact input id', proposedText: 'revised text', reason: 'brief reason' }],
        },
        rules: [
          'Use exactly the supplied segmentId values.',
          'Omit segments that do not need a change.',
          'Do not merge or split segments.',
          'Do not invent citations, identifiers, people, places, dates or facts.',
        ],
        segments: batch.map((segment) => ({ id: segment.id, text: segment.text, kind: segment.kind ?? null })),
      });

      const result = await runOmiAgent({
        agentId: 'language-editor',
        scope: documentScope,
        content: requestBody,
        context: {
          manuscriptId: manuscript.id,
          locale: manuscript.locale,
          title: manuscript.title,
          sectionTitle: scope === 'section' ? selectedSection?.title ?? null : null,
          client: 'omi-studio',
          structuredSegmentReview: true,
          batch: { index: index + 1, count: batches.length },
        },
        requestedPermissions: ['document.read', 'suggest'],
      });

      const parsed = parseStructuredSuggestions(result.suggestion);
      const originals = new Map(batch.map((segment) => [segment.id, segment.text]));
      for (const item of parsed) {
        const originalText = originals.get(item.segmentId);
        const blockId = blockIdFromSegmentId(item.segmentId);
        if (!originalText || !blockId || item.proposedText.trim() === originalText.trim()) continue;
        collected.push({
          segmentId: item.segmentId,
          blockId,
          originalText,
          proposedText: item.proposedText,
          reason: item.reason,
          model: result.model,
          auditId: result.auditId,
        });
      }
    }

    if (!collected.length) {
      setSuggestion(copy.noChanges);
      return;
    }
    setProposals(collected);
    setProposalIndex(0);
    setModel(collected[0]?.model ?? '');
  }

  async function acceptCurrentProposal(): Promise<void> {
    const proposal = currentProposal;
    if (!proposal) return;
    const next = applyStructuredTranslations(
      manuscript,
      { kind: 'block', id: proposal.blockId },
      [{ id: proposal.segmentId, text: proposal.proposedText }],
    );
    const nextBlock = next.sections.flatMap((section) => section.blocks).find((block) => block.id === proposal.blockId);
    if (!nextBlock) {
      setError(copy.applyFailed);
      return;
    }
    updateBlock(proposal.blockId, nextBlock.content);
    await recordOmiAgentReview({
      auditId: proposal.auditId,
      decision: 'accepted',
      blockId: proposal.blockId,
      segmentId: proposal.segmentId,
      model: proposal.model,
    }).catch(() => undefined);
    removeCurrentProposal();
  }

  async function rejectCurrentProposal(): Promise<void> {
    const proposal = currentProposal;
    if (!proposal) return;
    await recordOmiAgentReview({
      auditId: proposal.auditId,
      decision: 'rejected',
      blockId: proposal.blockId,
      segmentId: proposal.segmentId,
      model: proposal.model,
    }).catch(() => undefined);
    removeCurrentProposal();
  }

  function removeCurrentProposal(): void {
    setProposals((current) => current.filter((_, index) => index !== proposalIndex));
    setProposalIndex((current) => Math.max(0, current - (current > 0 ? 1 : 0)));
  }

  async function copySuggestion(): Promise<void> {
    const text = currentProposal?.proposedText ?? suggestion;
    if (!text) return;
    await navigator.clipboard.writeText(text);
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
        <Sparkles size={17} aria-hidden="true" /> {busy ? (progress || copy.running) : copy.run}
      </button>

      {error ? <p className="omi-integration-error" role="alert">{error}</p> : null}

      {currentProposal ? (
        <article className="omi-agents-workspace__result omi-agents-workspace__result--structured" aria-live="polite">
          <header>
            <div>
              <strong>{copy.structuredSuggestion}</strong>
              <small>{copy.proposalCounter(proposalIndex + 1, proposals.length)}{currentProposal.model ? ` · ${copy.model}: ${currentProposal.model}` : ''}</small>
            </div>
            <button type="button" className="omi-agents-workspace__dismiss" onClick={() => setProposals([])} aria-label={copy.dismiss}><X size={18} /></button>
          </header>
          <div className="omi-agents-workspace__diff">
            <div><strong>{copy.original}</strong><p>{currentProposal.originalText}</p></div>
            <div><strong>{copy.proposed}</strong><p>{currentProposal.proposedText}</p></div>
            {currentProposal.reason ? <small>{copy.reason}: {currentProposal.reason}</small> : null}
          </div>
          <div className="omi-agents-workspace__proposal-nav">
            <button type="button" className="studio-menu-secondary-action" disabled={proposalIndex === 0} onClick={() => setProposalIndex((value) => Math.max(0, value - 1))}><ChevronLeft size={16} />{copy.previous}</button>
            <button type="button" className="studio-menu-secondary-action" disabled={proposalIndex >= proposals.length - 1} onClick={() => setProposalIndex((value) => Math.min(proposals.length - 1, value + 1))}>{copy.next}<ChevronRight size={16} /></button>
          </div>
          <div className="omi-agents-workspace__result-actions">
            <button type="button" className="studio-menu-primary-action" onClick={() => void acceptCurrentProposal()}><Check size={16} />{copy.accept}</button>
            <button type="button" className="studio-menu-secondary-action" onClick={() => void rejectCurrentProposal()}>{copy.reject}</button>
            <button type="button" className="studio-menu-secondary-action" onClick={() => void copySuggestion()}>
              {copied ? <CheckCircle2 size={16} aria-hidden="true" /> : <Clipboard size={16} aria-hidden="true" />}
              {copied ? copy.copied : copy.copy}
            </button>
          </div>
          <p className="omi-agents-workspace__review-note">{copy.structuredReviewNote}</p>
        </article>
      ) : suggestion ? (
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

function createSegmentBatches(segments: TranslationSegment[]): TranslationSegment[][] {
  const batches: TranslationSegment[][] = [];
  let current: TranslationSegment[] = [];
  let currentCharacters = 0;
  for (const segment of segments) {
    const size = segment.id.length + segment.text.length + (segment.kind?.length ?? 0) + 80;
    if (current.length && currentCharacters + size > STRUCTURED_BATCH_CHARACTERS) {
      batches.push(current);
      current = [];
      currentCharacters = 0;
    }
    current.push(segment);
    currentCharacters += size;
  }
  if (current.length) batches.push(current);
  return batches;
}

function parseStructuredSuggestions(raw: string): Array<{ segmentId: string; proposedText: string; reason?: string }> {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value: unknown;
  try {
    value = JSON.parse(trimmed);
  } catch {
    throw new Error('The language editor did not return a valid structured suggestion payload.');
  }
  if (!value || typeof value !== 'object') return [];
  const suggestions = (value as { suggestions?: unknown }).suggestions;
  if (!Array.isArray(suggestions)) return [];
  return suggestions.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (typeof record.segmentId !== 'string' || typeof record.proposedText !== 'string') return [];
    return [{
      segmentId: record.segmentId,
      proposedText: record.proposedText,
      ...(typeof record.reason === 'string' ? { reason: record.reason } : {}),
    }];
  });
}

function blockIdFromSegmentId(segmentId: string): string | null {
  if (segmentId.startsWith('legacy:')) return segmentId.slice('legacy:'.length) || null;
  if (!segmentId.startsWith('block:')) return null;
  const remainder = segmentId.slice('block:'.length);
  const separator = remainder.indexOf(':');
  return separator < 0 ? null : remainder.slice(0, separator) || null;
}

function getCopy(locale: string) {
  if (locale === 'hu') return {
    description: 'Az aktív kéziratot a Studio szerverén futó OMI agentekkel elemezheted. A mobilalkalmazás nem tárol AI API-kulcsot.',
    safety: 'Az agent eredménye javaslat. A kéziratot nem módosítja automatikusan; a szerző dönt a felhasználásáról.',
    statusUnknown: 'Kapcsolat még nincs ellenőrizve.', ready: 'OMI Agents használatra kész.', notReady: 'OMI Agents nincs használatra kész.',
    checking: 'Ellenőrzés…', check: 'Kapcsolat ellenőrzése', agent: 'Agent', scope: 'Hatókör', currentSection: 'Aktuális szakasz', untitled: 'Névtelen szakasz',
    run: 'Agent futtatása', running: 'Agent dolgozik…', emptyScope: 'A kiválasztott hatókörben nincs feldolgozható tartalom.',
    suggestion: 'Agent javaslata', structuredSuggestion: 'Szerkesztési javaslat', model: 'Modell', copy: 'Másolás', copied: 'Másolva', reject: 'Elutasítás', dismiss: 'Javaslat bezárása',
    accept: 'Elfogadás', previous: 'Előző', next: 'Következő', original: 'Eredeti', proposed: 'Javasolt', reason: 'Indoklás', noChanges: 'A nyelvi szerkesztő nem talált módosítandó szövegrészt.', applyFailed: 'A javaslat nem alkalmazható a dokumentum megfelelő blokkjára.',
    reviewNote: 'A javaslat csak ellenőrzés után kerüljön a kéziratba.', structuredReviewNote: 'Elfogadáskor csak a megjelölt OMI szövegszegmens változik; a hivatkozások, jegyzetek és egyéb strukturált elemek érintetlenek maradnak.',
    progress: (current: number, total: number) => `Agent dolgozik… ${current}/${total}`,
    proposalCounter: (current: number, total: number) => `${current}/${total}. javaslat`,
    agents: { languageEditor: 'Nyelvi szerkesztő', metadataAssistant: 'Metaadat-asszisztens', summarizer: 'Összefoglaló', citationChecker: 'Hivatkozás-ellenőrző' },
    scopes: { section: 'Aktuális szakasz', manuscript: 'Teljes kézirat', metadata: 'Metaadatok', references: 'Hivatkozások' },
  };
  if (locale === 'de') return {
    description: 'Analysiere das aktive Manuskript mit OMI Agents, die über den Studio-Server ausgeführt werden. Die mobile App speichert keinen AI-API-Schlüssel.',
    safety: 'Agent-Ergebnisse sind Vorschläge. Das Manuskript wird nicht automatisch geändert; die Autorin oder der Autor entscheidet über die Übernahme.',
    statusUnknown: 'Verbindung wurde noch nicht geprüft.', ready: 'OMI Agents ist einsatzbereit.', notReady: 'OMI Agents ist nicht einsatzbereit.',
    checking: 'Prüfen…', check: 'Verbindung prüfen', agent: 'Agent', scope: 'Bereich', currentSection: 'Aktueller Abschnitt', untitled: 'Unbenannter Abschnitt',
    run: 'Agent ausführen', running: 'Agent arbeitet…', emptyScope: 'Der ausgewählte Bereich enthält keinen verarbeitbaren Inhalt.',
    suggestion: 'Agent-Vorschlag', structuredSuggestion: 'Redaktionsvorschlag', model: 'Modell', copy: 'Kopieren', copied: 'Kopiert', reject: 'Ablehnen', dismiss: 'Vorschlag schließen',
    accept: 'Übernehmen', previous: 'Zurück', next: 'Weiter', original: 'Original', proposed: 'Vorschlag', reason: 'Begründung', noChanges: 'Die Sprachredaktion hat keine zu ändernden Textsegmente gefunden.', applyFailed: 'Der Vorschlag konnte nicht auf den zugehörigen Dokumentblock angewendet werden.',
    reviewNote: 'Übernimm den Vorschlag erst nach eigener Prüfung in das Manuskript.', structuredReviewNote: 'Beim Übernehmen wird nur das bezeichnete OMI-Textsegment geändert; Zitate, Notizen und andere strukturierte Elemente bleiben erhalten.',
    progress: (current: number, total: number) => `Agent arbeitet… ${current}/${total}`,
    proposalCounter: (current: number, total: number) => `Vorschlag ${current}/${total}`,
    agents: { languageEditor: 'Sprachredaktion', metadataAssistant: 'Metadaten-Assistent', summarizer: 'Zusammenfassung', citationChecker: 'Zitationsprüfung' },
    scopes: { section: 'Aktueller Abschnitt', manuscript: 'Gesamtes Manuskript', metadata: 'Metadaten', references: 'Literaturangaben' },
  };
  return {
    description: 'Analyse the active manuscript with OMI Agents executed through the Studio server. The mobile app never stores the AI provider API key.',
    safety: 'Agent output is a suggestion. It never changes the manuscript automatically; the author decides whether to use it.',
    statusUnknown: 'Connection has not been checked yet.', ready: 'OMI Agents is ready.', notReady: 'OMI Agents is not ready.',
    checking: 'Checking…', check: 'Check connection', agent: 'Agent', scope: 'Scope', currentSection: 'Current section', untitled: 'Untitled section',
    run: 'Run agent', running: 'Agent is working…', emptyScope: 'The selected scope contains no content that the agent can process.',
    suggestion: 'Agent suggestion', structuredSuggestion: 'Editing suggestion', model: 'Model', copy: 'Copy', copied: 'Copied', reject: 'Reject', dismiss: 'Close suggestion',
    accept: 'Accept', previous: 'Previous', next: 'Next', original: 'Original', proposed: 'Proposed', reason: 'Reason', noChanges: 'The language editor found no text segments that need changes.', applyFailed: 'The suggestion could not be applied to its document block.',
    reviewNote: 'Review the suggestion before incorporating it into the manuscript.', structuredReviewNote: 'Accepting changes only the addressed OMI text segment; citations, notes and other structured nodes stay intact.',
    progress: (current: number, total: number) => `Agent is working… ${current}/${total}`,
    proposalCounter: (current: number, total: number) => `Suggestion ${current}/${total}`,
    agents: { languageEditor: 'Language editor', metadataAssistant: 'Metadata assistant', summarizer: 'Summarizer', citationChecker: 'Citation checker' },
    scopes: { section: 'Current section', manuscript: 'Whole manuscript', metadata: 'Metadata', references: 'References' },
  };
}
