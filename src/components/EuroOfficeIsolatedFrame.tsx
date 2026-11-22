import { useEffect, useRef, useState } from 'react';
import type { EuroOfficeLaunch } from '../services/euroOfficeApi';
import { DEFAULT_STUDIO_API_ORIGIN, getStudioApiBaseUrl } from '../services/studioServer';

const SCOPE = 'omi-eurooffice';

interface IsolatedFrameProps {
  launch: EuroOfficeLaunch;
  title: string;
  onFailure: (message: string) => void;
}

/**
 * Native Studio never evaluates the remote EuroOffice DocsAPI in its main
 * privileged WebView. The selected server hosts an unprivileged editor page
 * whose CSP pins DocsAPI scripts to its configured EuroOffice origin.
 *
 * The iframe is always cross-origin to the native app's tauri:// origin; the
 * ready/launch channel checks the opaque origin, exact source window and
 * random channel. The sandbox
 * never grants same-origin privileges, forms or popups.
 */
export function EuroOfficeIsolatedFrame({ launch, title, onFailure }: IsolatedFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [target] = useState(() => {
    // Native dev shells may use Vite's relative API proxy without a configured
    // base URL. The isolated editor needs an absolute HTTP(S) origin; use the
    // same documented public default as installed Studio when no override exists.
    const base = getStudioApiBaseUrl() || DEFAULT_STUDIO_API_ORIGIN;
    const url = new URL('/api/v1/eurooffice/embed-host', base);
    const channel = crypto.randomUUID().replaceAll('-', '');
    url.searchParams.set('channel', channel);
    return { url: url.toString(), origin: url.origin, channel };
  });

  useEffect(() => {
    let started = false;
    let failed = false;
    let phase: 'host' | 'document' = 'host';
    let launchSent = false;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== 'null' ||
          event.source !== ref.current?.contentWindow ||
          !event.data || event.data.scope !== SCOPE ||
          event.data.channel !== target.channel) return;

      // A later DocsAPI error still matters after the document became ready.
      if (failed || (started && event.data.action !== 'failed')) return;
      if (event.data.action === 'ready' && !launchSent) {
        launchSent = true;
        ref.current?.contentWindow?.postMessage({
          scope: SCOPE,
          channel: target.channel,
          action: 'launch',
          config: launch.config,
        }, '*');
      } else if (event.data.action === 'app-ready') {
        phase = 'document';
      } else if (event.data.action === 'started') {
        started = true;
      } else if (event.data.action === 'failed') {
        failed = true;
        const code = Number.isSafeInteger(event.data.errorCode) ? ` (code ${event.data.errorCode})` : '';
        onFailure(event.data.reason === 'document-error'
          ? `EuroOffice could not load this document${code}.`
          : 'The isolated EuroOffice editor could not start.');
      }
    };
    window.addEventListener('message', onMessage);
    const timeout = window.setTimeout(() => {
      if (!started && !failed) {
        failed = true;
        onFailure(phase === 'document'
          ? 'EuroOffice opened but the document did not become ready.'
          : 'The isolated EuroOffice editor did not respond.');
      }
    }, 60_000);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeout);
    };
  }, [launch, onFailure, target]);

  return (
    <iframe
      ref={ref}
      onLoad={() => ref.current?.contentWindow?.postMessage({
        scope: SCOPE, channel: target.channel, action: 'hello',
      }, '*')}
      title={title}
      className="plain-document-isolated-frame"
      src={target.url}
      sandbox="allow-scripts allow-downloads"
      referrerPolicy="no-referrer"
      onError={() => onFailure('The isolated EuroOffice editor could not be loaded.')}
    />
  );
}
