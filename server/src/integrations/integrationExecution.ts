import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';

import { prisma } from '../lib/prisma.js';
import { requestAiText, resolveAiEndpoint } from './aiProviderClient.js';
import { assertOmiAgentRunAllowed } from './omiAgentsConfig.js';
import { decryptSecret, type EncryptedSecret } from './secretCrypto.js';

export type ExternalDocumentScopeKind =
  | 'selection'
  | 'block'
  | 'section'
  | 'manuscript'
  | 'metadata'
  | 'references';

export interface ExternalDocumentScope {
  kind: ExternalDocumentScopeKind;
  id?: string | undefined;
  reviewConfidential?: boolean | undefined;
}

export interface TranslationSegment {
  id: string;
  text: string;
  kind?: string | undefined;
}

export interface TranslationRequest {
  sourceLanguage?: string | undefined;
  targetLanguage: string;
  formality?: 'default' | 'more' | 'less' | 'prefer_more' | 'prefer_less' | undefined;
  scope: ExternalDocumentScope;
  segments: TranslationSegment[];
  allowReviewConfidential?: boolean | undefined;
}

export interface TranslationResult {
  providerId: 'deepl';
  detectedSourceLanguage?: string | undefined;
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
  context?: Record<string, unknown> | undefined;
  requestedPermissions?: string[] | undefined;
  allowReviewConfidential?: boolean | undefined;
  allowDirectWrite?: boolean | undefined;
}

export interface AgentRunResult {
  providerId: 'ai-provider';
  agentId: BuiltInAgentId;
  mode: 'suggestion';
  scope: ExternalDocumentScope;
  suggestion: string;
  model?: string | undefined;
  auditId: string;
}

interface UserIntegrationRow {
  id: string;
  encrypted_secret: string | null;
  config: unknown;
}

const MAX_TRANSLATION_SEGMENTS = 200;
const MAX_TRANSLATION_CHARACTERS = 100_000;
const MAX_AGENT_CHARACTERS = 80_000;
const EXTERNAL_TIMEOUT_MS = 30_000;

export async function translateWithDeepL(
  userId: string,
  input: TranslationRequest,
): Promise<TranslationResult> {
  assertConfidentialScopeAllowed(input.scope, input.allowReviewConfidential);
  if (!input.targetLanguage.trim()) throw new Error('A target language is required.');
  if (input.segments.length < 1 || input.segments.length > MAX_TRANSLATION_SEGMENTS) {
    throw new Error(`DeepL requests must contain between 1 and ${MAX_TRANSLATION_SEGMENTS} segments.`);
  }

  const segments = input.segments.map((segment) => ({
    id: segment.id.trim(),
    text: segment.text,
    kind: segment.kind?.trim() || undefined,
  }));
  if (segments.some((segment) => !segment.id || !segment.text.trim())) {
    throw new Error('Every translation segment must have an id and non-empty text.');
  }
  const totalLength = segments.reduce((sum, segment) => sum + segment.text.length, 0);
  if (totalLength > MAX_TRANSLATION_CHARACTERS) {
    throw new Error(`DeepL request exceeds ${MAX_TRANSLATION_CHARACTERS} characters.`);
  }

  const connection = await resolveIntegrationConnection(userId, 'deepl');
  const apiKey = connection.secret;
  if (!apiKey) throw new Error('DeepL API key is not configured.');
  const endpoint = apiKey.endsWith(':fx')
    ? 'https://api-free.deepl.com/v2/translate'
    : 'https://api.deepl.com/v2/translate';

  const body = new URLSearchParams();
  for (const segment of segments) body.append('text', segment.text);
  body.set('target_lang', input.targetLanguage.trim().toUpperCase());
  if (input.sourceLanguage?.trim()) {
    body.set('source_lang', input.sourceLanguage.trim().toUpperCase());
  }
  if (input.formality && input.formality !== 'default') body.set('formality', input.formality);

  const auditId = randomUUID();
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
      signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`DeepL translation failed with HTTP ${response.status}.`);
    }
    const payload = await response.json() as {
      translations?: Array<{ text?: string; detected_source_language?: string }>;
    };
    if (!Array.isArray(payload.translations) || payload.translations.length !== segments.length) {
      throw new Error('DeepL returned an unexpected number of translated segments.');
    }
    const translated = segments.map((segment, index) => ({
      id: segment.id,
      kind: segment.kind,
      text: String(payload.translations?.[index]?.text ?? ''),
    }));
    if (translated.some((segment) => !segment.text)) {
      throw new Error('DeepL returned an invalid translation payload.');
    }

    await writeAuditEvent({
      id: auditId,
      userId,
      providerId: 'deepl',
      operation: 'translate',
      scope: input.scope,
      input: segments.map((segment) => segment.text).join('\n'),
      output: translated.map((segment) => segment.text).join('\n'),
      permissions: ['document.read', 'suggest'],
      directWrite: false,
      status: 'SUCCESS',
      detail: {
        targetLanguage: input.targetLanguage,
        sourceLanguage: input.sourceLanguage ?? null,
        segmentCount: segments.length,
      },
    });

    return {
      providerId: 'deepl',
      detectedSourceLanguage: payload.translations[0]?.detected_source_language,
      targetLanguage: input.targetLanguage,
      scope: input.scope,
      segments: translated,
    };
  } catch (error) {
    await writeAuditEvent({
      id: auditId,
      userId,
      providerId: 'deepl',
      operation: 'translate',
      scope: input.scope,
      input: segments.map((segment) => segment.text).join('\n'),
      permissions: ['document.read', 'suggest'],
      directWrite: false,
      status: 'ERROR',
      detail: { error: safeErrorMessage(error) },
    });
    throw error;
  }
}

export async function runBuiltInAgent(
  userId: string,
  input: AgentRunRequest,
): Promise<AgentRunResult> {
  assertConfidentialScopeAllowed(input.scope, input.allowReviewConfidential);
  if (!input.content.trim()) throw new Error('Agent input content is empty.');
  if (input.content.length > MAX_AGENT_CHARACTERS) {
    throw new Error(`Agent input exceeds ${MAX_AGENT_CHARACTERS} characters.`);
  }

  const requestedPermissions = uniqueStrings(input.requestedPermissions ?? ['document.read', 'suggest']);
  const allowedPermissions = new Set([
    'document.read',
    'metadata.read',
    'references.read',
    'suggest',
    'metadata.write',
    'document.write',
  ]);
  for (const permission of requestedPermissions) {
    if (!allowedPermissions.has(permission)) throw new Error(`Unsupported agent permission: ${permission}`);
  }
  const writeRequested = requestedPermissions.includes('document.write') || requestedPermissions.includes('metadata.write');
  if (writeRequested && input.allowDirectWrite !== true) {
    throw new Error('Direct document or metadata writes require explicit confirmation.');
  }

  await assertOmiAgentRunAllowed({
    userId,
    agentId: input.agentId,
    scopeKind: input.scope.kind,
    requestedPermissions,
    allowDirectWrite: input.allowDirectWrite,
  });

  const connection = await resolveIntegrationConnection(userId, 'ai-provider');
  const config = asRecord(connection.config);
  const endpoint = requireSafeHttpsEndpoint(resolveAiEndpoint(config ?? {}));
  const providerPreset = typeof config?.providerPreset === 'string' ? config.providerPreset : undefined;
  const model = typeof config?.model === 'string' && config.model.trim()
    ? config.model.trim()
    : undefined;
  const apiKey = connection.secret;
  if (!apiKey) throw new Error('The AI provider secret is not configured.');
  if (!model) throw new Error('The AI provider model is not configured.');

  const auditId = randomUUID();
  const systemPrompt = agentSystemPrompt(input.agentId);
  const scopeDescription = JSON.stringify({
    kind: input.scope.kind,
    id: input.scope.id ?? null,
    reviewConfidential: Boolean(input.scope.reviewConfidential),
  });
  const contextText = input.context ? JSON.stringify(input.context) : '{}';
  const userPrompt = `OMI document scope: ${scopeDescription}\nContext: ${contextText}\n\nContent:\n${input.content}`;

  try {
    const suggestion = await requestAiText({
      endpoint,
      providerPreset,
      model,
      apiKey,
      systemPrompt,
      userPrompt,
      timeoutMs: EXTERNAL_TIMEOUT_MS,
      maxOutputTokens: 4096,
    });

    await writeAuditEvent({
      id: auditId,
      userId,
      providerId: 'ai-provider',
      operation: input.agentId,
      scope: input.scope,
      input: input.content,
      output: suggestion,
      permissions: requestedPermissions,
      directWrite: false,
      status: 'SUCCESS',
      detail: { model, providerPreset: providerPreset ?? null, requestedDirectWrite: writeRequested },
    });

    return {
      providerId: 'ai-provider',
      agentId: input.agentId,
      mode: 'suggestion',
      scope: input.scope,
      suggestion,
      model,
      auditId,
    };
  } catch (error) {
    await writeAuditEvent({
      id: auditId,
      userId,
      providerId: 'ai-provider',
      operation: input.agentId,
      scope: input.scope,
      input: input.content,
      permissions: requestedPermissions,
      directWrite: false,
      status: 'ERROR',
      detail: { model, providerPreset: providerPreset ?? null, error: safeErrorMessage(error) },
    });
    throw error;
  }
}

export async function listIntegrationAuditEvents(userId: string, limit = 50) {
  const boundedLimit = Math.max(1, Math.min(200, Math.trunc(limit)));
  return prisma.$queryRaw<Array<{
    id: string;
    provider_id: string;
    operation: string;
    scope_kind: string;
    scope_id: string | null;
    input_digest: string | null;
    input_length: number | null;
    output_digest: string | null;
    output_length: number | null;
    permissions: unknown;
    review_confidential: boolean;
    direct_write: boolean;
    status: string;
    detail: unknown;
    created_at: Date;
  }>>`
    SELECT id, provider_id, operation, scope_kind, scope_id,
           input_digest, input_length, output_digest, output_length,
           permissions, review_confidential, direct_write, status, detail, created_at
    FROM integration_audit_events
    WHERE user_id = ${userId}::uuid
    ORDER BY created_at DESC
    LIMIT ${boundedLimit}
  `;
}

async function resolveIntegrationConnection(userId: string, providerId: string): Promise<{
  secret?: string | undefined;
  config: unknown;
}> {
  const userRows = await prisma.$queryRaw<UserIntegrationRow[]>`
    SELECT id, encrypted_secret, config
    FROM user_integrations
    WHERE user_id = ${userId}::uuid
      AND provider_id = ${providerId}
      AND enabled = TRUE
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const userConnection = userRows[0];
  if (userConnection?.encrypted_secret) {
    return {
      secret: decryptStoredSecret(userConnection.encrypted_secret),
      config: userConnection.config,
    };
  }

  const serverConfig = await prisma.integrationProviderConfig.findUnique({
    where: { providerId },
  });
  if (!serverConfig) throw new Error(`${providerId} is not configured.`);
  return {
    secret: serverConfig.encryptedSecret
      ? decryptStoredSecret(serverConfig.encryptedSecret)
      : undefined,
    config: serverConfig.config,
  };
}

async function writeAuditEvent(input: {
  id: string;
  userId: string;
  providerId: string;
  operation: string;
  scope: ExternalDocumentScope;
  input?: string;
  output?: string;
  permissions: string[];
  directWrite: boolean;
  status: 'SUCCESS' | 'ERROR';
  detail?: Record<string, unknown>;
}): Promise<void> {
  const inputDigest = input.input === undefined ? null : sha256(input.input);
  const outputDigest = input.output === undefined ? null : sha256(input.output);
  const inputLength = input.input?.length ?? null;
  const outputLength = input.output?.length ?? null;
  const permissions = JSON.stringify(input.permissions);
  const detail = input.detail ? JSON.stringify(input.detail) : null;
  await prisma.$executeRaw`
    INSERT INTO integration_audit_events
      (id, user_id, provider_id, operation, scope_kind, scope_id,
       input_digest, input_length, output_digest, output_length,
       permissions, review_confidential, direct_write, status, detail)
    VALUES
      (${input.id}::uuid, ${input.userId}::uuid, ${input.providerId}, ${input.operation},
       ${input.scope.kind}, ${input.scope.id ?? null}, ${inputDigest}, ${inputLength},
       ${outputDigest}, ${outputLength}, ${permissions}::jsonb,
       ${Boolean(input.scope.reviewConfidential)}, ${input.directWrite}, ${input.status},
       ${detail}::jsonb)
  `;
}

function assertConfidentialScopeAllowed(
  scope: ExternalDocumentScope,
  allowed: boolean | undefined,
): void {
  if (scope.reviewConfidential && allowed !== true) {
    throw new Error('Review-confidential content may only be sent to an external service after explicit permission.');
  }
}

function agentSystemPrompt(agentId: BuiltInAgentId): string {
  switch (agentId) {
    case 'language-editor':
      return 'You are an academic language editor. Return a proposed revision only. Preserve citations, identifiers, factual claims and scholarly meaning. Do not invent sources.';
    case 'metadata-assistant':
      return 'You are a scholarly metadata assistant. Return concise structured suggestions for titles, abstracts, keywords or identifiers based only on the supplied content. Do not invent identifiers.';
    case 'summarizer':
      return 'Summarize the supplied scholarly content faithfully and compactly. Do not add facts or citations that are not present.';
    case 'citation-checker':
      return 'Inspect the supplied scholarly content and citation context. Report possible missing, inconsistent or suspicious citations as suggestions. Never fabricate bibliographic records.';
  }
}

function decryptStoredSecret(value: string): string {
  const parsed = JSON.parse(value) as Partial<EncryptedSecret>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
    throw new Error('Stored integration secret is invalid.');
  }
  return decryptSecret(parsed as EncryptedSecret);
}

function requireSafeHttpsEndpoint(raw: string): string {
  const url = new URL(raw.trim());
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('AI provider endpoint must be a credential-free HTTPS URL.');
  }
  const hostname = url.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    isPrivateIp(hostname)
  ) {
    throw new Error('AI provider endpoint may not target a local or private network address.');
  }
  return url.toString();
}

function isPrivateIp(hostname: string): boolean {
  const version = isIP(hostname);
  if (version === 4) {
    const [a = 0, b = 0] = hostname.split('.').map(Number);
    return a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (version === 6) {
    return hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') || hostname.startsWith('fe8') || hostname.startsWith('fe9') || hostname.startsWith('fea') || hostname.startsWith('feb');
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function safeErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'External integration failed.';
}
