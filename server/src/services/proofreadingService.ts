import { runBuiltInAgent } from '../integrations/integrationExecution.js';

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
  return checkWithAi(userId, input.text, input.language, input.blockId);
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

  return { providerId: 'languagetool', language, issues };
}

async function checkWithAi(
  userId: string,
  text: string,
  language: string,
  blockId?: string,
): Promise<ProofreadingResult> {
  const result = await runBuiltInAgent(userId, {
    agentId: 'language-editor',
    scope: { kind: 'block', id: blockId },
    content: text,
    requestedPermissions: ['document.read', 'suggest'],
    context: {
      language,
      proofreadingStructured: true,
      instruction: [
        'Return ONLY valid JSON.',
        'Use UTF-16 string offsets relative to the supplied Content.',
        'Do not rewrite the whole passage.',
        'Schema: {"issues":[{"offset":0,"length":1,"message":"...","category":"spelling|grammar|punctuation|style","replacements":["..."]}]}',
        'Return at most 50 issues and at most 5 replacements per issue.',
      ].join(' '),
    },
  });

  const parsed = parseAiIssues(result.suggestion, text.length);
  return {
    providerId: 'ai-provider',
    language: normalizeLanguage(language),
    issues: parsed,
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
