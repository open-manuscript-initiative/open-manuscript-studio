import { useEffect, useRef, useState } from 'react';
import type { EuroOfficeLaunch } from '../services/euroOfficeApi';
import { getStudioApiBaseUrl } from '../services/studioServer';

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
 * ready/launch channel uses both source-window and exact-origin validation.
 */
export function EuroOfficeIsolatedFrame({ launch, title, onFailure }: IsolatedFrameProps) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [target] = useState(() => {
    const base = getStudioApiBaseUrl();
    if (!base) throw new Error('The selected Studio server is unavailable for EuroOffice.');
    const url = new URL('/api/v1/eurooffice/embed-host', base);
    const channel = crypto.randomUUID().replaceAll('-', '');
    url.searchParams.set('channel', channel);
    return { url: url.toString(), origin: url.origin, channel };
  });

  useEffect(() => {
    let started = false;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== target.origin ||
          event.source !== ref.current?.contentWindow ||
          !event.data || event.data.scope !== SCOPE ||
          event.data.channel !== target.channel) return;

      if (event.data.action === 'ready') {
        ref.current?.contentWindow?.postMessage({
          scope: SCOPE,
          channel: target.channel,
          action: 'launch',
          config: launch.config,
        }, target.origin);
      } else if (event.data.action === 'started') {
        started = true;
      } else if (event.data.action === 'failed') {
        onFailure('The isolated EuroOffice editor could not start.');
      }
    };
    window.addEventListener('message', onMessage);
    const timeout = window.setTimeout(() => {
      if (!started) onFailure('The isolated EuroOffice editor did not respond.');
    }, 30_000);
    return () => {
      window.removeEventListener('message', onMessage);
      window.clearTimeout(timeout);
    };
  }, [launch, onFailure, target]);

  return (
    <iframe
      ref={ref}
      title={title}
      className="plain-document-isolated-frame"
      src={target.url}
      sandbox="allow-scripts allow-same-origin allow-forms allow-downloads allow-popups"
      referrerPolicy="no-referrer"
      onError={() => onFailure('The isolated EuroOffice editor could not be loaded.')}
    />
  );
}
