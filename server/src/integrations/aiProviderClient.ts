export type AiProviderPreset = 'openai' | 'mistral' | 'groq' | 'openrouter' | 'custom';

export interface AiProviderConfig {
  providerPreset?: unknown;
  endpoint?: unknown;
  model?: unknown;
}

export interface AiTextRequest {
  endpoint: string;
  providerPreset?: string | undefined;
  model: string;
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  timeoutMs: number;
  maxOutputTokens?: number | undefined;
}

export function resolveAiEndpoint(config: AiProviderConfig): string {
  const preset = typeof config.providerPreset === 'string' ? config.providerPreset : '';
  if (preset === 'openai') return 'https://api.openai.com/v1/responses';
  return typeof config.endpoint === 'string' ? config.endpoint.trim() : '';
}

export function usesResponsesApi(providerPreset: string | undefined, endpoint: string): boolean {
  if (providerPreset === 'openai') return true;
  try {
    const url = new URL(endpoint);
    return url.hostname.toLowerCase() === 'api.openai.com' && url.pathname.replace(/\/$/, '') === '/v1/responses';
  } catch {
    return false;
  }
}

export async function requestAiText(input: AiTextRequest): Promise<string> {
  const responsesApi = usesResponsesApi(input.providerPreset, input.endpoint);
  const response = await fetch(input.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(responsesApi
      ? {
          model: input.model,
          input: [
            {
              role: 'system',
              content: [{ type: 'input_text', text: input.systemPrompt }],
            },
            {
              role: 'user',
              content: [{ type: 'input_text', text: input.userPrompt }],
            },
          ],
          max_output_tokens: input.maxOutputTokens ?? 256,
        }
      : {
          model: input.model,
          messages: [
            { role: 'system', content: input.systemPrompt },
            { role: 'user', content: input.userPrompt },
          ],
          max_tokens: input.maxOutputTokens ?? 256,
        }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  const contentType = response.headers.get('content-type') ?? '';
  const payload = contentType.includes('application/json')
    ? await response.json() as unknown
    : null;

  if (!response.ok) {
    const detail = extractProviderError(payload);
    throw new Error(
      `AI provider request failed with HTTP ${response.status}${detail ? `: ${detail}` : '.'}`,
    );
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`AI provider returned ${contentType || 'a non-JSON response'} instead of JSON.`);
  }

  const text = responsesApi ? extractResponsesText(payload) : extractChatCompletionsText(payload);
  if (!text) {
    throw new Error(
      responsesApi
        ? 'AI provider returned no text in the Responses API payload.'
        : 'AI provider returned no text in the chat-completions payload.',
    );
  }
  return text;
}

function extractChatCompletionsText(payload: unknown): string {
  const record = asRecord(payload);
  const choices = Array.isArray(record?.choices) ? record.choices : [];
  const first = asRecord(choices[0]);
  const message = asRecord(first?.message);
  return typeof message?.content === 'string' ? message.content.trim() : '';
}

function extractResponsesText(payload: unknown): string {
  const record = asRecord(payload);
  if (typeof record?.output_text === 'string' && record.output_text.trim()) {
    return record.output_text.trim();
  }
  const output = Array.isArray(record?.output) ? record.output : [];
  const parts: string[] = [];
  for (const item of output) {
    const itemRecord = asRecord(item);
    const content = Array.isArray(itemRecord?.content) ? itemRecord.content : [];
    for (const part of content) {
      const partRecord = asRecord(part);
      if (partRecord?.type === 'output_text' && typeof partRecord.text === 'string') {
        parts.push(partRecord.text);
      }
    }
  }
  return parts.join('\n').trim();
}

function extractProviderError(payload: unknown): string {
  const record = asRecord(payload);
  const error = asRecord(record?.error);
  const message = typeof error?.message === 'string'
    ? error.message
    : typeof record?.message === 'string'
      ? record.message
      : '';
  return message.replace(/\s+/g, ' ').trim().slice(0, 500);
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}
