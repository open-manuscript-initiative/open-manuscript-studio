import { randomBytes } from 'node:crypto';

/**
 * This standalone HTML contains no user document, editor credentials or
 * session token. The parent delivers the short-lived editor launch only
 * after a verified frame-origin/channel handshake.
 *
 * The browser-executed bootstrap is serialized by the server TypeScript build;
 * no untrusted strings are interpolated into executable JavaScript.
 */
interface IsolatedDomElement {
  id: string;
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  append(node: IsolatedDomElement): void;
  replaceChildren(): void;
}
interface IsolatedOfficeBrowser {
  document: {
    head: { append(node: IsolatedDomElement): void };
    createElement(tag: string): IsolatedDomElement;
    getElementById(id: string): IsolatedDomElement | null;
  };
  location: { search: string };
  parent: { postMessage(value: unknown, targetOrigin: string): void };
  addEventListener(type: string, listener: (event: {
    source: unknown; origin: string; data: unknown
  }) => void): void;
  DocsAPI?: { DocEditor: new (
    id: string, config: Record<string, unknown>
  ) => { destroyEditor?: () => void } };
}

function isolatedBootstrap(
  apiUrl: string,
  allowedParents: string[],
): void {
  const win = globalThis as unknown as IsolatedOfficeBrowser;
  const doc = win.document;
  const channel = new URLSearchParams(win.location.search).get('channel');
  const scope = 'omi-eurooffice';
  let ready = false;
  let editor: { destroyEditor?: () => void } | undefined;
  const report = (action: string) =>
    win.parent.postMessage({ scope, channel, action }, '*');

  win.addEventListener('message', (event) => {
    if (event.source !== win.parent || !allowedParents.includes(event.origin)) return;
    const message = event.data as {
      scope?: string; channel?: string; action?: string;
      config?: Record<string, unknown> & { token?: string }
    } | null;
    if (!message || message.scope !== scope || message.channel !== channel ||
        message.action !== 'launch' || !ready ||
        !message.config || typeof message.config !== 'object' ||
        typeof message.config.token !== 'string') return;
    try {
      editor?.destroyEditor?.();
      const host = doc.getElementById('editor');
      if (!host) throw new Error('EuroOffice editor host unavailable');
      host.replaceChildren();
      const placeholder = doc.createElement('div');
      placeholder.id = 'eurooffice-editor-frame';
      host.append(placeholder);
      const docsApi = win.DocsAPI;
      if (!docsApi) throw new Error('Editor API missing');
      editor = new docsApi.DocEditor(placeholder.id, message.config);
      report('started');
    } catch {
      report('failed');
    }
  });

  if (!channel || !/^[A-Za-z0-9_-]{16,80}$/.test(channel)) return;
  const script = doc.createElement('script');
  script.src = apiUrl;
  script.onload = () => {
    const docsApi = win.DocsAPI;
    if (typeof docsApi?.DocEditor !== 'function') {
      report('failed');
      return;
    }
    ready = true;
    report('ready');
  };
  script.onerror = () => report('failed');
  doc.head.append(script);
}

export function buildEuroOfficeEmbedHost(
  officeUrl: string,
  frontendOrigin: string,
): { html: string; csp: string } {
  const office = new URL(officeUrl);
  const frontend = new URL(frontendOrigin);
  if (office.protocol !== 'https:' || office.username || office.password ||
      !['https:', 'http:'].includes(frontend.protocol) || office.hash || office.search) {
    throw new Error('EuroOffice embed host requires a configured HTTPS origin');
  }
  const apiUrl = new URL('web-apps/apps/api/documents/api.js',
    office.href.endsWith('/') ? office : new URL(office.href + '/'));
  if (apiUrl.origin !== office.origin) {
    throw new Error('The editor script cannot leave the configured origin');
  }
  const nonce = randomBytes(24).toString('base64');
  const parentOrigins = [...new Set([
    frontend.origin,
    'tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost',
    'http://localhost:5173', 'http://127.0.0.1:5173',
  ])];
  const safeJson = (value: unknown) => JSON.stringify(value)
    .replace(/</g, '\\u003c').replace(/>/g, '\\u003e');
  const csp = [
    "default-src 'none'",
    "script-src 'nonce-" + nonce + "' " + office.origin,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline' " + office.origin,
    "img-src 'self' data: blob: " + office.origin,
    "font-src 'self' data: " + office.origin,
    "connect-src 'self' " + office.origin,
    "frame-src " + office.origin,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors " + parentOrigins.join(' '),
    "form-action 'none'",
  ].join('; ');
  const script = '(' + isolatedBootstrap.toString() + ')(' +
    safeJson(apiUrl.toString()) + ',' + safeJson(parentOrigins) + ');';
  const html = '<!doctype html><html lang="en"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<title>EuroOffice isolated editor</title>' +
    '<style>html,body,#editor{margin:0;width:100%;height:100%;overflow:hidden}</style>' +
    '</head><body><div id="editor"></div><script nonce="' + nonce + '">' +
    script.replace(/</g, '\\u003c') + '</script></body></html>';
  return { html, csp };
}
