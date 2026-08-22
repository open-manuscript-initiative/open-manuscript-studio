import { isIP } from 'node:net';

import { decryptSecret, type EncryptedSecret } from '../integrations/secretCrypto.js';
import { prisma } from '../lib/prisma.js';

export type ProofreadingCategory = 'spelling' | 'grammar' | 'punctuation' | 'style';

export interface ProofreadingIssue {
  id: string;
  offset: number;
  length: number;
  message: string;
  shortMessage?: string | undefined;
  category: ProofreadingCategory;
  replacements: string[];
  ruleId?: string | undefined;
}

export interface ProofreadingResult {
  providerId: 'languagetool' | 'ai-provider';
  language: string;
  issues: ProofreadingIssue[];
}

interface CheckInput {
  language: string;
  text: string;
  blockId?: string | undefined;
}

interface UserIntegrationRow {
  encrypted_secret: string | null;
  config: unknown;
}

const MAX_ISSUES = 100;
const EXTERNAL_TIMEOUT_MS = 20_000;

export async function checkProofreading(
  userId: string,
  input: CheckInput,
): Promise<ProofreadingResult> {
  const language = normalizeLanguage(input.language);
  if (language === 'en' || language === 'de') {
    return checkWithLanguageTool(input.text, input.language);
  }
  return checkWithAi(userId, input.text, input.language);
}

async function checkWithLanguageTool(
  text: string,
  language: string,
): Promise<ProofreadingResult> {
  const body = new URLSearchParams({ text, language });
  const response = await fetch('https://api.languagetool.org/v2/check', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
  });
  if (!response.ok) {
    throw new Error(`LanguageTool request failed with HTTP ${response.status}.`);
  }

  const payload = await response.json() as {
    matches?: Array<{
      offset?: number;
      length?: number;
      message?: string;
      shortMessage?: string;
      replacements?: Array<{ value?: string }>;
      rule?: {
        id?: string;
        issueType?: string;
        category?: { id?: string; name?: string };
      };
    }>;
  };

  const issues = (payload.matches ?? [])
    .slice(0, MAX_ISSUES)
    .map((match, index): ProofreadingIssue | null => {
      const offset = Number(match.offset);
      const length = Number(match.length);
      if (!Number.isInteger(offset) || !Number.isInteger(length) || length <= 0) return null;
      return {
        id: `lt-${index}-${offset}`,
        offset,
        length,
        message: match.message?.trim() || 'Language issue',
        shortMessage: match.shortMessage?.trim() || undefined,
        category: classifyLanguageToolIssue(match.rule),
        replacements: (match.replacements ?? [])
          .map((item) => item.value?.trim())
          .filter((value): value is string => Boolean(value))
          .slice(0, 6),
        ruleId: match.rule?.id,
      };
    })
    .filter((issue): issue is ProofreadingIssue => Boolean(issue));

  return { providerId: 'languagetool', language: normalizeLanguage(language), issues };
}

async function checkWithAi(
  userId: string,
  text: string,
  language: string,
): Promise<ProofreadingResult> {
  const connection = await resolveAiConnection(userId);
  const config = asRecord(connection.config);
  const endpoint = safeHttpsEndpoint(String(config?.endpoint ?? ''));
  const model = typeof config?.model === 'string' && config.model.trim()
    ? config.model.trim()
    : '';
  if (!connection.secret) throw new Error('The AI provider secret is not configured.');
  if (!model) throw new Error('The AI provider model is not configured.');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${connection.secret}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: 'system',
          content: [
            'You are an academic proofreader.',
            'Find only real spelling, grammar, punctuation and style issues.',
            'Preserve scholarly meaning, citations, names and identifiers.',
            'Return ONLY valid JSON with schema:',
            '{"issues":[{"offset":0,"length":1,"message":"...","category":"spelling|grammar|punctuation|style","replacements":["..."]}]}',
            'Offsets and lengths must use UTF-16 string indexing relative to the exact input text.',
            'Return at most 50 issues and at most 5 replacements per issue.',
          ].join(' '),
        },
        {
          role: 'user',
          content: `Language: ${language}\n\nExact input text:\n${text}`,
        },
      ],
      temperature: 0.1,
    }),
    signal: AbortSignal.timeout(EXTERNAL_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`AI proofreading request failed with HTTP ${response.status}.`);
  const payload = await response.json() as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = payload.choices?.[0]?.message?.content?.trim();
  if (!raw) throw new Error('AI provider returned no proofreading result.');

  return {
    providerId: 'ai-provider',
    language: normalizeLanguage(language),
    issues: parseAiIssues(raw, text.length),
  };
}

async function resolveAiConnection(userId: string): Promise<{
  secret?: string | undefined;
  config: unknown;
}> {
  const rows = await prisma.$queryRaw<UserIntegrationRow[]>`
    SELECT encrypted_secret, config
    FROM user_integrations
    WHERE user_id = ${userId}::uuid
      AND provider_id = 'ai-provider'
      AND enabled = TRUE
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  const userConnection = rows[0];
  if (userConnection?.encrypted_secret) {
    return {
      secret: decryptStoredSecret(userConnection.encrypted_secret),
      config: userConnection.config,
    };
  }

  const serverConfig = await prisma.integrationProviderConfig.findUnique({
    where: { providerId: 'ai-provider' },
  });
  if (!serverConfig) throw new Error('ai-provider is not configured.');
  return {
    secret: serverConfig.encryptedSecret
      ? decryptStoredSecret(serverConfig.encryptedSecret)
      : undefined,
    config: serverConfig.config,
  };
}

function parseAiIssues(raw: string, textLength: number): ProofreadingIssue[] {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    return [];
  }
  if (!value || typeof value !== 'object') return [];
  const issues = (value as { issues?: unknown }).issues;
  if (!Array.isArray(issues)) return [];

  return issues.slice(0, 50).flatMap((item, index) => {
    if (!item || typeof item !== 'object') return [];
    const row = item as Record<string, unknown>;
    const offset = Number(row.offset);
    const length = Number(row.length);
    const message = typeof row.message === 'string' ? row.message.trim() : '';
    const category = normalizeCategory(row.category);
    if (!Number.isInteger(offset) || !Number.isInteger(length) || length <= 0) return [];
    if (offset < 0 || offset + length > textLength || !message) return [];
    const replacements = Array.isArray(row.replacements)
      ? row.replacements.filter((entry): entry is string => typeof entry === 'string' && Boolean(entry.trim())).slice(0, 5)
      : [];
    return [{
      id: `ai-${index}-${offset}`,
      offset,
      length,
      message,
      category,
      replacements,
    } satisfies ProofreadingIssue];
  });
}

function classifyLanguageToolIssue(rule: {
  issueType?: string;
  category?: { id?: string; name?: string };
} | undefined): ProofreadingCategory {
  const type = rule?.issueType?.toLowerCase() ?? '';
  const category = `${rule?.category?.id ?? ''} ${rule?.category?.name ?? ''}`.toLowerCase();
  if (type.includes('misspell') || category.includes('typo') || category.includes('spelling')) return 'spelling';
  if (type.includes('typograph') || category.includes('punct')) return 'punctuation';
  if (type.includes('style') || category.includes('style')) return 'style';
  return 'grammar';
}

function normalizeCategory(value: unknown): ProofreadingCategory {
  return value === 'spelling' || value === 'punctuation' || value === 'style'
    ? value
    : 'grammar';
}

function normalizeLanguage(language: string): string {
  return language.trim().toLowerCase().split(/[-_]/)[0] || 'en';
}

function decryptStoredSecret(value: string): string {
  const parsed = JSON.parse(value) as Partial<EncryptedSecret>;
  if (!parsed.ciphertext || !parsed.iv || !parsed.authTag) {
    throw new Error('Stored integration secret is invalid.');
  }
  return decryptSecret(parsed as EncryptedSecret);
}

function safeHttpsEndpoint(raw: string): string {
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
    return a === 10 || a === 127 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
  }
  if (version === 6) {
    return hostname === '::1' || hostname.startsWith('fc') || hostname.startsWith('fd') ||
      hostname.startsWith('fe8') || hostname.startsWith('fe9') ||
      hostname.startsWith('fea') || hostname.startsWith('feb');
  }
  return false;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
