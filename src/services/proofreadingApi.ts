const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

export type ProofreadingCategory = 'spelling' | 'grammar' | 'punctuation' | 'style';

export interface ProofreadingIssue {
  id: string;
  offset: number;
  length: number;
  message: string;
  shortMessage?: string;
  category: ProofreadingCategory;
  replacements: string[];
  ruleId?: string;
}

export interface ProofreadingResult {
  providerId: 'languagetool' | 'ai-provider';
  language: string;
  issues: ProofreadingIssue[];
}

export async function checkProofreading(input: {
  language: string;
  text: string;
  blockId: string;
  signal?: AbortSignal;
}): Promise<ProofreadingResult> {
  const response = await fetch(`${API_BASE_URL}/integrations/proofreading/check`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      language: input.language,
      text: input.text,
      blockId: input.blockId,
    }),
    signal: input.signal,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null) as
      | { error?: { message?: string } }
      | null;
    throw new Error(payload?.error?.message ?? `Proofreading failed with HTTP ${response.status}.`);
  }
  return await response.json() as ProofreadingResult;
}
