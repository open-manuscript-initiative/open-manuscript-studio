const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type ExternalDocumentScopeKind =
  | 'selection'
  | 'block'
  | 'section'
  | 'manuscript'
  | 'metadata'
  | 'references';

export interface ExternalDocumentScope {
  kind: ExternalDocumentScopeKind;
  id?: string;
  reviewConfidential?: boolean;
}

export interface TranslationSegment {
  id: string;
  text: string;
  kind?: string;
}

export interface DeepLTranslationRequest {
  sourceLanguage?: string;
  targetLanguage: string;
  formality?: 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less';
  scope: ExternalDocumentScope;
  segments: TranslationSegment[];
  allowReviewConfidential?: boolean;
}

export interface DeepLTranslationResult {
  providerId: 'deepl';
  detectedSourceLanguage?: string;
  targetLanguage: string;
  scope: ExternalDocumentScope;
  segments: TranslationSegment[];
}

export type BuiltInAgentId =
  | 'language-editor'
  | 'metadata-assistant'
  | 'summarizer'
  | 'citation-checker';

export interface AgentRunRequest {
  agentId: BuiltInAgentId;
  scope: ExternalDocumentScope;
  content: string;
  context?: Record<string, unknown>;
  requestedPermissions?: string[];
  allowReviewConfidential?: boolean;
  allowDirectWrite?: boolean;
}

export interface AgentRunResult {
  providerId: 'ai-provider';
  agentId: BuiltInAgentId;
  mode: 'suggestion';
  scope: ExternalDocumentScope;
  suggestion: string;
  model?: string;
  auditId: string;
}

export interface IntegrationAuditEvent {
  id: string;
  providerId: string;
  operation: string;
  scope: { kind: string; id: string | null };
  inputDigest: string | null;
  inputLength: number | null;
  outputDigest: string | null;
  outputLength: number | null;
  permissions: unknown;
  reviewConfidential: boolean;
  directWrite: boolean;
  status: string;
  detail: unknown;
  createdAt: string;
}

export interface IntegrationExtensionManifest {
  model: 'omi-integration-extension';
  apiVersion: '1';
  id: string;
  name: string;
  version: string;
  kind:
    | 'translation'
    | 'ai'
    | 'agent'
    | 'storage'
    | 'publishing'
    | 'identity'
    | 'scholarly-service';
  description?: string;
  authenticationModes: Array<
    'none' | 'server_secret' | 'user_api_key' | 'oauth2' | 'oidc' | 'integration_token'
  >;
  permissions: string[];
  capabilities: string[];
  endpoints?: Record<string, string>;
}

export interface RegisteredIntegrationExtension {
  id: string;
  extensionId: string;
  manifest: IntegrationExtensionManifest;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranslationVariant {
  id: string;
  manuscriptId: string;
  sourceLocale: string | null;
  targetLocale: string;
  scope: { kind: 'section' | 'manuscript'; id: string | null };
  providerId: string;
  translatedState: unknown;
  createdAt: string;
  updatedAt: string;
}

async function readError(response: Response, fallback: string): Promise<Error> {
  const payload = await response.json().catch(() => null) as
    | { error?: { message?: string } }
    | null;
  return new Error(payload?.error?.message ?? fallback);
}

export async function translateWithDeepL(
  request: DeepLTranslationRequest,
): Promise<DeepLTranslationResult> {
  const response = await fetch(`${API_BASE_URL}/integrations/deepl/translate`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw await readError(response, `DeepL translation failed with HTTP ${response.status}.`);
  }
  return await response.json() as DeepLTranslationResult;
}

export async function runIntegrationAgent(
  request: AgentRunRequest,
): Promise<AgentRunResult> {
  const response = await fetch(`${API_BASE_URL}/integrations/agents/run`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });
  if (!response.ok) {
    throw await readError(response, `Agent execution failed with HTTP ${response.status}.`);
  }
  return await response.json() as AgentRunResult;
}

export async function getIntegrationAuditEvents(limit = 50): Promise<IntegrationAuditEvent[]> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/audit?limit=${encodeURIComponent(String(limit))}`,
    { credentials: 'include', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    throw await readError(response, `Integration audit request failed with HTTP ${response.status}.`);
  }
  const payload = await response.json() as { events: IntegrationAuditEvent[] };
  return payload.events;
}

export async function getIntegrationExtensions(): Promise<RegisteredIntegrationExtension[]> {
  const response = await fetch(`${API_BASE_URL}/integrations/extensions`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
  });
  if (!response.ok) {
    throw await readError(response, `Extension registry request failed with HTTP ${response.status}.`);
  }
  const payload = await response.json() as { extensions: RegisteredIntegrationExtension[] };
  return payload.extensions;
}

export async function saveIntegrationExtension(
  manifest: IntegrationExtensionManifest,
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/integrations/extensions`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(manifest),
  });
  if (!response.ok) {
    throw await readError(response, `Extension registration failed with HTTP ${response.status}.`);
  }
}

export async function deleteIntegrationExtension(extensionId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/extensions/${encodeURIComponent(extensionId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw await readError(response, `Extension deletion failed with HTTP ${response.status}.`);
  }
}

export async function getTranslationVariants(manuscriptId: string): Promise<TranslationVariant[]> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/translation-variants?manuscriptId=${encodeURIComponent(manuscriptId)}`,
    { credentials: 'include', headers: { Accept: 'application/json' } },
  );
  if (!response.ok) {
    throw await readError(response, `Translation variant request failed with HTTP ${response.status}.`);
  }
  const payload = await response.json() as { variants: TranslationVariant[] };
  return payload.variants;
}

export async function saveTranslationVariant(input: {
  manuscriptId: string;
  sourceLocale?: string;
  targetLocale: string;
  scope: { kind: 'section' | 'manuscript'; id?: string };
  translatedState: unknown;
}): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/integrations/translation-variants`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ...input, providerId: 'deepl' }),
  });
  if (!response.ok) {
    throw await readError(response, `Translation variant save failed with HTTP ${response.status}.`);
  }
  const payload = await response.json() as { id: string };
  return payload.id;
}

export async function deleteTranslationVariant(variantId: string): Promise<void> {
  const response = await fetch(
    `${API_BASE_URL}/integrations/translation-variants/${encodeURIComponent(variantId)}`,
    {
      method: 'DELETE',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    },
  );
  if (!response.ok && response.status !== 204) {
    throw await readError(response, `Translation variant deletion failed with HTTP ${response.status}.`);
  }
}
