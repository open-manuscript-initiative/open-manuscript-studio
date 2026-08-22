export interface WebBibliographicProvider {
  id: string;
  name: string;
  loginUrl: string;
  searchUrlTemplate: string;
  logoutUrl?: string;
  enabled: boolean;
}

export interface WebBibliographicProviderDraft {
  name: string;
  loginUrl: string;
  searchUrlTemplate: string;
  logoutUrl?: string;
}

export type WebBibliographicProviderValidationIssue =
  | 'name'
  | 'login-url'
  | 'search-template'
  | 'logout-url';

export interface WebBibliographicSessionResult {
  mode: 'tauri-webview' | 'browser';
  cleared: boolean;
}

export const ACADEMIA_WEB_PROVIDER: WebBibliographicProvider = {
  id: 'academia',
  name: 'Academia.edu',
  loginUrl: 'https://www.academia.edu/login',
  searchUrlTemplate: 'https://www.academia.edu/search?q={query}',
  logoutUrl: 'https://www.academia.edu/logout',
  enabled: true,
};

const SETTINGS_KEY = 'omi-studio-web-bibliographic-providers';
const SEARCH_TOKEN = '{query}';

export function loadWebBibliographicProviders(): WebBibliographicProvider[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];

    return parsed
      .map((provider) => normalizeWebBibliographicProvider(provider))
      .filter(isWebBibliographicProvider);
  } catch {
    return [];
  }
}

export function saveWebBibliographicProviders(
  providers: WebBibliographicProvider[],
): void {
  if (typeof window === 'undefined') return;

  const safeProviders = providers
    .map((provider) => normalizeWebBibliographicProvider(provider))
    .filter(isWebBibliographicProvider);

  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(safeProviders));
}

export function normalizeWebBibliographicProvider(
  value: unknown,
): WebBibliographicProvider | undefined {
  if (!isRecord(value)) return undefined;

  const id = normalizeProviderId(stringValue(value.id));
  const name = stringValue(value.name).trim();
  const loginUrl = normalizeHttpsUrl(stringValue(value.loginUrl));
  const searchUrlTemplate = normalizeSearchTemplate(
    stringValue(value.searchUrlTemplate),
  );
  const rawLogoutUrl = stringValue(value.logoutUrl).trim();
  const logoutUrl = rawLogoutUrl ? normalizeHttpsUrl(rawLogoutUrl) : undefined;

  if (!id || !name || !loginUrl || !searchUrlTemplate) return undefined;
  if (rawLogoutUrl && !logoutUrl) return undefined;

  return {
    id,
    name,
    loginUrl,
    searchUrlTemplate,
    ...(logoutUrl ? { logoutUrl } : {}),
    enabled: value.enabled !== false,
  };
}

export function validateWebBibliographicProviderDraft(
  draft: WebBibliographicProviderDraft,
): WebBibliographicProviderValidationIssue | undefined {
  if (!draft.name.trim()) return 'name';
  if (!normalizeHttpsUrl(draft.loginUrl)) return 'login-url';
  if (!normalizeSearchTemplate(draft.searchUrlTemplate)) {
    return 'search-template';
  }
  if (draft.logoutUrl?.trim() && !normalizeHttpsUrl(draft.logoutUrl)) {
    return 'logout-url';
  }
  return undefined;
}

export function createWebBibliographicProvider(
  draft: WebBibliographicProviderDraft,
  existingIds: string[] = [],
): WebBibliographicProvider {
  const validationIssue = validateWebBibliographicProviderDraft(draft);
  if (validationIssue) {
    throw new Error(`Invalid web bibliographic provider: ${validationIssue}`);
  }

  const baseId = normalizeProviderId(draft.name) || 'provider';
  let id = baseId;
  let suffix = 2;

  while (existingIds.includes(id)) {
    id = `${baseId}-${suffix}`;
    suffix += 1;
  }

  return {
    id,
    name: draft.name.trim(),
    loginUrl: normalizeHttpsUrl(draft.loginUrl)!,
    searchUrlTemplate: normalizeSearchTemplate(draft.searchUrlTemplate)!,
    ...(draft.logoutUrl?.trim()
      ? { logoutUrl: normalizeHttpsUrl(draft.logoutUrl)! }
      : {}),
    enabled: true,
  };
}

export function buildWebBibliographicSearchUrl(
  provider: WebBibliographicProvider,
  query: string,
): string {
  const normalizedProvider = normalizeWebBibliographicProvider(provider);
  if (!normalizedProvider) {
    throw new Error('Invalid web bibliographic provider configuration.');
  }

  const normalizedQuery = query.trim();
  if (normalizedQuery.length < 2) {
    throw new Error('Bibliographic search query is too short.');
  }

  return normalizedProvider.searchUrlTemplate.replaceAll(
    SEARCH_TOKEN,
    encodeURIComponent(normalizedQuery),
  );
}

export async function openWebBibliographicLogin(
  provider: WebBibliographicProvider,
): Promise<WebBibliographicSessionResult> {
  const normalizedProvider = requireProvider(provider);
  return openProviderUrl(normalizedProvider, normalizedProvider.loginUrl);
}

export async function openWebBibliographicSearch(
  provider: WebBibliographicProvider,
  query: string,
): Promise<WebBibliographicSessionResult> {
  const normalizedProvider = requireProvider(provider);
  return openProviderUrl(
    normalizedProvider,
    buildWebBibliographicSearchUrl(normalizedProvider, query),
  );
}

export async function clearWebBibliographicSession(
  provider: WebBibliographicProvider,
): Promise<WebBibliographicSessionResult> {
  const normalizedProvider = requireProvider(provider);

  if (!isTauriRuntime()) {
    if (normalizedProvider.logoutUrl) {
      openBrowserWindow(
        normalizedProvider.logoutUrl,
        `omi-bibliographic-logout-${normalizedProvider.id}`,
      );
    }
    return { mode: 'browser', cleared: false };
  }

  const webview = await createTauriProviderWindow(
    normalizedProvider,
    'about:blank',
    false,
  );

  try {
    await webview.clearAllBrowsingData();
  } finally {
    await webview.destroy();
  }

  return { mode: 'tauri-webview', cleared: true };
}

async function openProviderUrl(
  provider: WebBibliographicProvider,
  url: string,
): Promise<WebBibliographicSessionResult> {
  if (!isTauriRuntime()) {
    openBrowserWindow(url, `omi-bibliographic-${provider.id}`);
    return { mode: 'browser', cleared: false };
  }

  await createTauriProviderWindow(provider, url, true);
  return { mode: 'tauri-webview', cleared: false };
}

async function createTauriProviderWindow(
  provider: WebBibliographicProvider,
  url: string,
  visible: boolean,
) {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  const label = providerWindowLabel(provider.id);
  const existing = await WebviewWindow.getByLabel(label);

  if (existing) {
    await existing.destroy();
  }

  const webview = new WebviewWindow(label, {
    url,
    title: `${provider.name} — OMI Studio`,
    width: 1120,
    height: 780,
    minWidth: 680,
    minHeight: 520,
    resizable: true,
    visible,
    focus: visible,
    dataDirectory: 'bibliographic-session',
    dataStoreIdentifier: providerDataStoreIdentifier(provider.id),
  });

  await waitForWebviewCreation(webview);
  return webview;
}

function waitForWebviewCreation(
  webview: Awaited<ReturnType<typeof createTauriWebviewType>>,
): Promise<void> {
  return new Promise((resolve, reject) => {
    void webview.once('tauri://created', () => resolve());
    void webview.once<unknown>('tauri://error', (event) => {
      reject(
        new Error(
          typeof event.payload === 'string'
            ? event.payload
            : 'Could not open provider webview.',
        ),
      );
    });
  });
}

async function createTauriWebviewType() {
  const { WebviewWindow } = await import('@tauri-apps/api/webviewWindow');
  return new WebviewWindow('type-placeholder', { url: 'about:blank' });
}

function providerWindowLabel(providerId: string): string {
  return `bibliographic-provider-${normalizeProviderId(providerId) || 'provider'}`;
}

function providerDataStoreIdentifier(providerId: string): number[] {
  const seed = `omi-bibliographic-provider:${providerId}`;
  const bytes: number[] = [];
  let state = 2166136261;

  for (let index = 0; index < 16; index += 1) {
    for (let charIndex = 0; charIndex < seed.length; charIndex += 1) {
      state ^= seed.charCodeAt(charIndex) + index;
      state = Math.imul(state, 16777619);
    }
    bytes.push((state >>> ((index % 4) * 8)) & 0xff);
  }

  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  return bytes;
}

function openBrowserWindow(url: string, name: string): void {
  if (typeof window === 'undefined') {
    throw new Error('Browser window is not available.');
  }

  const opened = window.open(url, name, 'noopener,noreferrer');
  if (!opened) {
    throw new Error('The provider window was blocked by the browser.');
  }
}

function normalizeSearchTemplate(value: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed.includes(SEARCH_TOKEN)) return undefined;

  const probe = trimmed.replaceAll(SEARCH_TOKEN, 'omi-search-probe');
  return normalizeHttpsUrl(probe) ? trimmed : undefined;
}

function normalizeHttpsUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:') return undefined;
    if (url.username || url.password) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeProviderId(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function requireProvider(
  provider: WebBibliographicProvider,
): WebBibliographicProvider {
  const normalized = normalizeWebBibliographicProvider(provider);
  if (!normalized) {
    throw new Error('Invalid web bibliographic provider configuration.');
  }
  return normalized;
}

function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function isWebBibliographicProvider(
  value: WebBibliographicProvider | undefined,
): value is WebBibliographicProvider {
  return Boolean(value);
}
