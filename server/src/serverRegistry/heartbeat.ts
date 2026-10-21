import { env } from '../config/env.js';

const HEARTBEAT_INTERVAL_MS = 5 * 60 * 1000;

export function startServerRegistryHeartbeat(): (() => void) | null {
  const instanceId = env.OMI_SERVER_REGISTRY_INSTANCE_ID;
  const heartbeatToken = env.OMI_SERVER_REGISTRY_HEARTBEAT_TOKEN;
  if (!instanceId && !heartbeatToken) return null;
  if (!instanceId || !heartbeatToken) {
    console.error('Studio server registry heartbeat is disabled: both instance ID and heartbeat token must be configured.');
    return null;
  }

  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let retryDelayMs = 60_000;
  const endpoint = new URL(
    `/api/v1/server-registry/instances/${encodeURIComponent(instanceId)}/heartbeat`,
    env.OMI_SERVER_REGISTRY_ORIGIN,
  );

  const sendHeartbeat = async (): Promise<void> => {
    if (stopped) return;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
      redirect: 'error',
        headers: {
          Authorization: `Bearer ${heartbeatToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          softwareVersion: env.OMI_SERVER_REGISTRY_SOFTWARE_VERSION ?? 'unknown',
          capabilities: env.OMI_SERVER_REGISTRY_CAPABILITIES
            .split(',')
            .map((value) => value.trim())
            .filter(Boolean),
        }),
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      retryDelayMs = HEARTBEAT_INTERVAL_MS + Math.floor(Math.random() * 30_000);
      timer = setTimeout(() => { void sendHeartbeat(); }, retryDelayMs);
    } catch (error) {
      console.warn('Studio server registry heartbeat failed; retrying later.', error);
      retryDelayMs = Math.min(Math.max(retryDelayMs * 2, 30_000), HEARTBEAT_INTERVAL_MS);
      timer = setTimeout(() => { void sendHeartbeat(); }, retryDelayMs + Math.floor(Math.random() * 5_000));
    }
  };

  timer = setTimeout(() => { void sendHeartbeat(); }, Math.floor(Math.random() * 30_000));
  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
  };
}
