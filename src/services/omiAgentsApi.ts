import { isTauri } from '@tauri-apps/api/core';

import type {
  AgentRunRequest,
  AgentRunResult,
} from './integrationExecutionApi';

const NATIVE_SESSION_KEY = 'omi_native_session_token';
const NATIVE_API_BASE_URL = 'https://studio.openmanuscript.org/api';
const IS_TAURI = detectTauriRuntime();
const API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_API_BASE_URL ??
    (IS_TAURI && !import.meta.env.DEV ? NATIVE_API_BASE_URL : '/api'),
);

// The server deliberately caps one agent request at 80,000 characters.
// Keep client chunks below that boundary so whole-manuscript analysis also
// works for book-length documents and leaves room for future request framing.
const AGENT_CHUNK_CHARACTERS = 64_000;

/**
 * Runs an OMI Agent against content of any practical manuscript size.
 * Small inputs use one request. Large inputs are split on paragraph
 * boundaries where possible and processed sequentially. Each server call is
 * independently permission-checked and audited.
 */
export async function runOmiAgent(request: AgentRunRequest): Promise<AgentRunResult> {
  if (request.content.length <= AGENT_CHUNK_CHARACTERS) {
    return runOmiAgentSingle(request);
  }

  const chunks = splitAgentContent(request.content, AGENT_CHUNK_CHARACTERS);
  const results: AgentRunResult[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const result = await runOmiAgentSingle({
      ...request,
      content: chunks[index]!,
      context: {
        ...(request.context ?? {}),
        chunk: {
          index: index + 1,
          count: chunks.length,
          continuation: index > 0,
        },
      },
    });
    results.push(result);
  }

  const first = results[0]!;
  const last = results[results.length - 1]!;
  return {
    ...first,
    suggestion: results.map((result) => result.suggestion.trim()).filter(Boolean).join('\n\n---\n\n'),
    model: first.model ?? last.model,
    auditId: last.auditId,
  };
}

async function runOmiAgentSingle(request: AgentRunRequest): Promise<AgentRunResult> {
  const response = await fetch(`${API_BASE_URL}/integrations/agents/run`, {
    method: 'POST',
    credentials: 'include',
    headers: nativeHeaders({
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response, `Agent execution failed with HTTP ${response.status}.`));
  }

  return parseJsonResponse<AgentRunResult>(response);
}

function splitAgentContent(content: string, maxCharacters: number): string[] {
  const normalized = content.trim();
  if (normalized.length <= maxCharacters) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    const value = current.trim();
    if (value) chunks.push(value);
    current = '';
  };

  for (const paragraph of paragraphs) {
    const value = paragraph.trim();
    if (!value) continue;

    if (value.length > maxCharacters) {
      flush();
      for (let offset = 0; offset < value.length; offset += maxCharacters) {
        chunks.push(value.slice(offset, offset + maxCharacters));
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${value}` : value;
    if (candidate.length > maxCharacters) {
      flush();
      current = value;
    } else {
      current = candidate;
    }
  }

  flush();
  return chunks;
}

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return fallback;

  const body = await response.json().catch(() => null) as
    | { error?: { message?: string; fields?: Record<string, string[] | undefined> } }
    | null;
  const message = body?.error?.message ?? fallback;
  const fieldDetails = Object.entries(body?.error?.fields ?? {})
    .flatMap(([field, messages]) => (messages ?? []).map((item) => `${field}: ${item}`))
    .join('; ');
  return fieldDetails ? `${message} ${fieldDetails}` : message;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) {
    const preview = (await response.text()).trim().slice(0, 120);
    throw new Error(
      `OMI Agents API returned ${contentType || 'an unknown content type'} instead of JSON${preview ? `: ${preview}` : '.'}`,
    );
  }
  return await response.json() as T;
}

function nativeHeaders(input: HeadersInit = {}): Headers {
  const headers = new Headers(input);
  if (!IS_TAURI) return headers;

  headers.set('X-OMI-Native-Client', '1');
  const token = globalThis.localStorage?.getItem(NATIVE_SESSION_KEY);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  return headers;
}

function detectTauriRuntime(): boolean {
  if (isTauri()) return true;
  const location = globalThis.location;
  if (!location) return false;
  return location.protocol === 'tauri:' || location.hostname === 'tauri.localhost';
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/$/, '');
}
