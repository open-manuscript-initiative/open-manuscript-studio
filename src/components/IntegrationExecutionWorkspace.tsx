import { Bot, FileClock, Languages, Puzzle, RefreshCw, Sparkles, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';

import { useStudioStore } from '../app/useStudioStore';
import {
  applyStructuredTranslations,
  buildStructuredTranslationPlan,
} from '../integrations/structuredExternalContent';
import {
  deleteIntegrationExtension,
  deleteTranslationVariant,
  getIntegrationAuditEvents,
  getIntegrationExtensions,
  getTranslationVariants,
  runIntegrationAgent,
  saveIntegrationExtension,
  saveTranslationVariant,
  translateWithDeepL,
  type BuiltInAgentId,
  type ExternalDocumentScope,
  type IntegrationAuditEvent,
  type IntegrationExtensionManifest,
  type RegisteredIntegrationExtension,
  type TranslationSegment,
  type TranslationVariant,
} from '../services/integrationExecutionApi';
import {
  saveIntegrationConnection,
  testIntegrationConnection,
} from '../services/integrationApi';
import type { OmiManuscript } from '../types/omi';
import './IntegrationExecutionWorkspace.css';

const DEFAULT_EXTENSION_MANIFEST = JSON.stringify({
  model: 'omi-integration-extension',
  apiVersion: '1',
  id: 'org.example.scholar-service',
  name: 'Example scholarly service',
  version: '0.1.0',
  kind: 'scholarly-service',
  authenticationModes: ['oauth2'],
  permissions: ['metadata.read'],
  capabilities: ['metadata.lookup'],
  endpoints: {
    lookup: 'https://example.org/api/lookup',
  },
}, null, 2);

const TARGET_LANGUAGES = [
  ['EN', 'English'],
  ['DE', 'Deutsch'],
  ['HU', 'Magyar'],
  ['FR', 'Français'],
  ['ES', 'Español'],
  ['IT', 'Italiano'],
  ['NL', 'Nederlands'],
  ['PL', 'Polski'],
  ['PT', 'Português'],
  ['JA', '日本語'],
] as const;

export function IntegrationExecutionWorkspace() {
  const manuscript = useStudioStore((state) => state.manuscript);
  const selectedSectionId = useStudioStore((state) => state.selectedSectionId);
  const [translationScope, setTranslationScope] = useState<'section' | 'manuscript'>('section');
  const [targetLanguage, setTargetLanguage] = useState('EN');
  const [translationBusy, setTranslationBusy] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [translatedSegments, setTranslatedSegments] = useState<TranslationSegment[]>([]);
  const [translatedManuscript, setTranslatedManuscript] = useState<OmiManuscript | null>(null);
  const [variants, setVariants] = useState<TranslationVariant[]>([]);

  const [aiEndpoint, setAiEndpoint] = useState('https://api.openai.com/v1/chat/completions');
  const [aiModel, setAiModel] = useState('');
  const [aiSecret, setAiSecret] = useState('');
  const [aiConfigBusy, setAiConfigBusy] = useState(false);
  const [aiConfigError, setAiConfigError] = useState('');
  const [aiConfigNotice, setAiConfigNotice] = useState('');

  const [agentId, setAgentId] = useState<BuiltInAgentId>('language-editor');
  const [agentScope, setAgentScope] = useState<'section' | 'manuscript' | 'metadata' | 'references'>('section');
  const [agentBusy, setAgentBusy] = useState(false);
  const [agentError, setAgentError] = useState('');
  const [agentSuggestion, setAgentSuggestion] = useState('');

  const [extensions, setExtensions] = useState<RegisteredIntegrationExtension[]>([]);
  const [manifestText, setManifestText] = useState(DEFAULT_EXTENSION_MANIFEST);
  const [extensionBusy, setExtensionBusy] = useState(false);
  const [extensionError, setExtensionError] = useState('');

  const [auditEvents, setAuditEvents] = useState<IntegrationAuditEvent[]>([]);
  const [auditError, setAuditError] = useState('');

  const selectedSection = useMemo(
    () => manuscript.sections.find((section) => section.id === selectedSectionId) ?? manuscript.sections[0],
    [manuscript.sections, selectedSectionId],
  );

  useEffect(() => {
    void refreshStoredData();
    // Refresh when the active manuscript changes; failures remain non-blocking.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manuscript.id]);

  async function refreshStoredData(): Promise<void> {
    setAuditError('');
    try {
      const [nextVariants, nextExtensions, nextAudit] = await Promise.all([
        getTranslationVariants(manuscript.id),
        getIntegrationExtensions(),
        getIntegrationAuditEvents(30),
      ]);
      setVariants(nextVariants);
      setExtensions(nextExtensions);
      setAuditEvents(nextAudit);
    } catch (error) {
      setAuditError(error instanceof Error ? error.message : String(error));
    }
  }

  async function saveAiConfiguration(): Promise<void> {
    setAiConfigBusy(true);
    setAiConfigError('');
    setAiConfigNotice('');
    try {
      const endpoint = new URL(aiEndpoint.trim());
      if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password) {
        throw new Error('The AI endpoint must be a credential-free HTTPS URL.');
      }
      if (!aiModel.trim() || !aiSecret.trim()) {
        throw new Error('Model name and API secret are required.');
      }
      await saveIntegrationConnection('ai-provider', {
        connectionKey: 'default',
        displayName: 'Default AI provider',
        authenticationMode: 'user_api_key',
        secret: aiSecret.trim(),
        config: {
          endpoint: endpoint.toString(),
          model: aiModel.trim(),
        },
        enabled: true,
      });
      setAiSecret('');
      const status = await testIntegrationConnection('ai-provider');
      setAiConfigNotice(status.message ?? 'AI provider configuration saved.');
    } catch (error) {
      setAiConfigError(error instanceof Error ? error.message : String(error));
    } finally {
      setAiConfigBusy(false);
    }
  }

  async function testAiConfiguration(): Promise<void> {
    setAiConfigBusy(true);
    setAiConfigError('');
    setAiConfigNotice('');
    try {
      const status = await testIntegrationConnection('ai-provider');
      setAiConfigNotice(status.message ?? 'AI provider configuration is ready.');
    } catch (error) {
      setAiConfigError(error instanceof Error ? error.message : String(error));
    } finally {
      setAiConfigBusy(false);
    }
  }

  function currentTranslationScope(): ExternalDocumentScope {
    if (translationScope === 'manuscript') return { kind: 'manuscript', id: manuscript.id };
    return { kind: 'section', id: selectedSection?.id };
  }

  async function translateScope(): Promise<void> {
    const scope = currentTranslationScope();
    if (scope.kind === 'section' && !scope.id) {
      setTranslationError('Select a manuscript section before translating.');
      return;
    }
    const plan = buildStructuredTranslationPlan(manuscript, scope);
    if (plan.segments.length === 0) {
      setTranslationError('The selected scope contains no translatable text.');
      return;
    }

    setTranslationBusy(true);
    setTranslationError('');
    setTranslatedSegments([]);
    setTranslatedManuscript(null);
    try {
      const translated = await translateSegmentsInBatches(
        plan.segments,
        scope,
        manuscript.locale,
        targetLanguage,
      );
      setTranslatedSegments(translated);
      setTranslatedManuscript(applyStructuredTranslations(manuscript, scope, translated));
      await refreshStoredData();
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : String(error));
    } finally {
      setTranslationBusy(false);
    }
  }

  async function persistVariant(): Promise<void> {
    if (!translatedManuscript) return;
    const scope = currentTranslationScope();
    if (scope.kind !== 'section' && scope.kind !== 'manuscript') return;

    setTranslationBusy(true);
    setTranslationError('');
    try {
      const translatedState = scope.kind === 'section'
        ? {
            section: translatedManuscript.sections.find((section) => section.id === scope.id),
            sourceManuscriptId: manuscript.id,
          }
        : {
            title: translatedManuscript.title,
            subtitle: translatedManuscript.subtitle,
            abstract: translatedManuscript.abstract,
            keywords: translatedManuscript.keywords,
            sections: translatedManuscript.sections,
            annotations: translatedManuscript.annotations,
            sourceManuscriptId: manuscript.id,
          };
      await saveTranslationVariant({
        manuscriptId: manuscript.id,
        sourceLocale: manuscript.locale,
        targetLocale: targetLanguage,
        scope: { kind: scope.kind, id: scope.id },
        translatedState,
      });
      await refreshStoredData();
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : String(error));
    } finally {
      setTranslationBusy(false);
    }
  }

  async function removeVariant(id: string): Promise<void> {
    await deleteTranslationVariant(id);
    await refreshStoredData();
  }

  function getAgentInput(): { scope: ExternalDocumentScope; content: string } | null {
    if (agentScope === 'metadata') {
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
    if (agentScope === 'references') {
      return {
        scope: { kind: 'references', id: manuscript.id },
        content: JSON.stringify(manuscript.bibliographicRecords ?? [], null, 2),
      };
    }
    const scope: ExternalDocumentScope = agentScope === 'manuscript'
      ? { kind: 'manuscript', id: manuscript.id }
      : { kind: 'section', id: selectedSection?.id };
    const plan = buildStructuredTranslationPlan(manuscript, scope);
    if (plan.segments.length === 0) return null;
    return { scope, content: plan.segments.map((segment) => segment.text).join('\n\n') };
  }

  async function runAgent(): Promise<void> {
    const input = getAgentInput();
    if (!input?.content.trim()) {
      setAgentError('The selected scope contains no content for the agent.');
      return;
    }
    setAgentBusy(true);
    setAgentError('');
    setAgentSuggestion('');
    try {
      const requestedPermissions = agentId === 'metadata-assistant'
        ? ['metadata.read', 'suggest']
        : agentId === 'citation-checker'
          ? ['document.read', 'references.read', 'suggest']
          : ['document.read', 'suggest'];
      const result = await runIntegrationAgent({
        agentId,
        scope: input.scope,
        content: input.content,
        context: {
          manuscriptId: manuscript.id,
          locale: manuscript.locale,
          title: manuscript.title,
        },
        requestedPermissions,
      });
      setAgentSuggestion(result.suggestion);
      await refreshStoredData();
    } catch (error) {
      setAgentError(error instanceof Error ? error.message : String(error));
    } finally {
      setAgentBusy(false);
    }
  }

  async function registerExtension(): Promise<void> {
    setExtensionBusy(true);
    setExtensionError('');
    try {
      const manifest = JSON.parse(manifestText) as IntegrationExtensionManifest;
      await saveIntegrationExtension(manifest);
      await refreshStoredData();
    } catch (error) {
      setExtensionError(error instanceof Error ? error.message : String(error));
    } finally {
      setExtensionBusy(false);
    }
  }

  async function removeExtension(extensionId: string): Promise<void> {
    setExtensionBusy(true);
    setExtensionError('');
    try {
      await deleteIntegrationExtension(extensionId);
      await refreshStoredData();
    } catch (error) {
      setExtensionError(error instanceof Error ? error.message : String(error));
    } finally {
      setExtensionBusy(false);
    }
  }

  return (
    <div className="omi-integration-workspace">
      <section className="omi-integration-workspace-card">
        <header><Sparkles size={18} aria-hidden="true" /><div><h4>AI provider configuration</h4><p>Configure an OpenAI-compatible chat-completions endpoint. The API secret is encrypted server-side and is never returned to the browser.</p></div></header>
        <div className="omi-integration-workspace-grid">
          <label><span>HTTPS endpoint</span><input type="url" value={aiEndpoint} onChange={(event) => setAiEndpoint(event.target.value)} placeholder="https://provider.example/v1/chat/completions" /></label>
          <label><span>Model</span><input value={aiModel} onChange={(event) => setAiModel(event.target.value)} placeholder="model-name" /></label>
          <label><span>API secret</span><input type="password" autoComplete="off" value={aiSecret} onChange={(event) => setAiSecret(event.target.value)} placeholder="API key" /></label>
        </div>
        <div className="omi-integration-card__actions">
          <button type="button" className="studio-menu-primary-action" disabled={aiConfigBusy} onClick={() => void saveAiConfiguration()}>{aiConfigBusy ? 'Saving…' : 'Save AI provider'}</button>
          <button type="button" className="studio-menu-secondary-action" disabled={aiConfigBusy} onClick={() => void testAiConfiguration()}>Test configuration</button>
        </div>
        {aiConfigNotice ? <p role="status">{aiConfigNotice}</p> : null}
        {aiConfigError ? <p className="omi-integration-error" role="alert">{aiConfigError}</p> : null}
      </section>

      <section className="omi-integration-workspace-card">
        <header><Languages size={18} aria-hidden="true" /><div><h4>DeepL translation workspace</h4><p>Translate structured OMI content without rewriting citations, cross-references, bibliography records, code blocks, or equations.</p></div></header>
        <div className="omi-integration-workspace-grid">
          <label><span>Scope</span><select value={translationScope} onChange={(event) => setTranslationScope(event.target.value as 'section' | 'manuscript')}><option value="section">Current section</option><option value="manuscript">Whole manuscript</option></select></label>
          <label><span>Target language</span><select value={targetLanguage} onChange={(event) => setTargetLanguage(event.target.value)}>{TARGET_LANGUAGES.map(([value, label]) => <option value={value} key={value}>{label} ({value})</option>)}</select></label>
        </div>
        {translationScope === 'section' ? <small>Current section: {selectedSection?.title || 'Untitled section'}</small> : null}
        <div className="omi-integration-card__actions">
          <button type="button" className="studio-menu-primary-action" disabled={translationBusy} onClick={() => void translateScope()}>{translationBusy ? 'Translating…' : 'Translate'}</button>
          <button type="button" className="studio-menu-secondary-action" disabled={translationBusy || !translatedManuscript} onClick={() => void persistVariant()}>Save as language variant</button>
        </div>
        {translationError ? <p className="omi-integration-error" role="alert">{translationError}</p> : null}
        {translatedSegments.length ? <div className="omi-translation-preview"><strong>Translation preview</strong>{translatedSegments.slice(0, 8).map((segment) => <p key={segment.id}>{segment.text}</p>)}{translatedSegments.length > 8 ? <small>+ {translatedSegments.length - 8} more structured segments</small> : null}</div> : null}
        {variants.length ? <div className="omi-integration-record-list"><strong>Saved variants</strong>{variants.map((variant) => <div key={variant.id} className="omi-integration-record"><span><b>{variant.targetLocale}</b> · {variant.scope.kind}{variant.scope.id ? ` · ${variant.scope.id}` : ''} · {new Date(variant.updatedAt).toLocaleString()}</span><button type="button" className="studio-menu-secondary-action" onClick={() => void removeVariant(variant.id)}><Trash2 size={14} aria-hidden="true" /> Delete</button></div>)}</div> : null}
      </section>

      <section className="omi-integration-workspace-card">
        <header><Bot size={18} aria-hidden="true" /><div><h4>OMI agents</h4><p>Agents return suggestions by default. They never mutate manuscript state on the server.</p></div></header>
        <div className="omi-integration-workspace-grid">
          <label><span>Agent</span><select value={agentId} onChange={(event) => setAgentId(event.target.value as BuiltInAgentId)}><option value="language-editor">Language editor</option><option value="metadata-assistant">Metadata assistant</option><option value="summarizer">Summarizer</option><option value="citation-checker">Citation checker</option></select></label>
          <label><span>Scope</span><select value={agentScope} onChange={(event) => setAgentScope(event.target.value as typeof agentScope)}><option value="section">Current section</option><option value="manuscript">Whole manuscript</option><option value="metadata">Metadata</option><option value="references">References</option></select></label>
        </div>
        <div className="omi-integration-card__actions"><button type="button" className="studio-menu-primary-action" disabled={agentBusy} onClick={() => void runAgent()}>{agentBusy ? 'Running…' : 'Create suggestion'}</button></div>
        {agentError ? <p className="omi-integration-error" role="alert">{agentError}</p> : null}
        {agentSuggestion ? <div className="omi-agent-suggestion"><strong>Suggestion</strong><pre>{agentSuggestion}</pre><small>Review the suggestion before applying it. Selection-level suggestions can be applied explicitly from the editor toolbar.</small></div> : null}
      </section>

      <section className="omi-integration-workspace-card">
        <header><Puzzle size={18} aria-hidden="true" /><div><h4>Extension SDK registry</h4><p>Register OMI Integration Extension API v1 manifests with explicit capabilities and scoped permissions.</p></div></header>
        <textarea className="omi-extension-manifest-editor" spellCheck={false} value={manifestText} onChange={(event) => setManifestText(event.target.value)} />
        <div className="omi-integration-card__actions"><button type="button" className="studio-menu-primary-action" disabled={extensionBusy} onClick={() => void registerExtension()}>{extensionBusy ? 'Saving…' : 'Register manifest'}</button></div>
        {extensionError ? <p className="omi-integration-error" role="alert">{extensionError}</p> : null}
        {extensions.length ? <div className="omi-integration-record-list">{extensions.map((extension) => <div key={extension.id} className="omi-integration-record"><span><b>{extension.manifest.name}</b> · {extension.extensionId} · v{extension.manifest.version}</span><button type="button" className="studio-menu-secondary-action" disabled={extensionBusy} onClick={() => void removeExtension(extension.extensionId)}><Trash2 size={14} aria-hidden="true" /> Remove</button></div>)}</div> : null}
      </section>

      <section className="omi-integration-workspace-card">
        <header><FileClock size={18} aria-hidden="true" /><div><h4>Integration audit trail</h4><p>The log stores operation metadata and SHA-256 digests, not manuscript text or provider secrets.</p></div><button type="button" className="studio-menu-secondary-action" onClick={() => void refreshStoredData()}><RefreshCw size={14} aria-hidden="true" /> Refresh</button></header>
        {auditError ? <p className="omi-integration-error" role="alert">{auditError}</p> : null}
        <div className="omi-integration-audit-list">{auditEvents.map((event) => <div className="omi-integration-audit-row" key={event.id}><span className={`omi-integration-status omi-integration-status--${event.status === 'success' ? 'connected' : 'available'}`}>{event.status}</span><strong>{event.providerId}</strong><span>{event.operation}</span><span>{event.scope.kind}</span><span>{event.inputLength ?? 0} → {event.outputLength ?? 0} chars</span><time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time></div>)}</div>
      </section>
    </div>
  );
}

async function translateSegmentsInBatches(
  segments: TranslationSegment[],
  scope: ExternalDocumentScope,
  sourceLanguage: string,
  targetLanguage: string,
): Promise<TranslationSegment[]> {
  const output: TranslationSegment[] = [];
  let batch: TranslationSegment[] = [];
  let characters = 0;

  async function flush(): Promise<void> {
    if (!batch.length) return;
    const result = await translateWithDeepL({
      sourceLanguage,
      targetLanguage,
      scope,
      segments: batch,
    });
    output.push(...result.segments);
    batch = [];
    characters = 0;
  }

  for (const segment of segments) {
    const wouldOverflow = batch.length >= 150 || characters + segment.text.length > 75_000;
    if (wouldOverflow) await flush();
    batch.push(segment);
    characters += segment.text.length;
  }
  await flush();
  return output;
}
