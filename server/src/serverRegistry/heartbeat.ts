import { env } from '../config/env.js';
import { HEARTBEAT_INTERVAL_SECONDS } from './policy.js';
import { publicServerIdentity } from './identity.js';
import { refreshLocalRegistryEntry } from './localEntry.js';

const HEARTBEAT_INTERVAL_MS = HEARTBEAT_INTERVAL_SECONDS * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

export function startServerRegistryHeartbeat(): (() => void) | null {
  const instanceId = env.OMI_SERVER_REGISTRY_INSTANCE_ID;
  const heartbeatToken = env.OMI_SERVER_REGISTRY_HEARTBEAT_TOKEN;
  const identity = publicServerIdentity('0'.repeat(64));
  const localRegistry = identity?.origin === new URL(env.OMI_SERVER_REGISTRY_ORIGIN).origin;
  const automatic = localRegistry || !instanceId || !heartbeatToken;
  if (automatic && !identity) return null;
  if (automatic && !localRegistry && (instanceId || heartbeatToken)) {
    console.warn('Incomplete legacy registry credentials; using automatic HTTPS discovery.');
  }

  let stopped = false;
  let timer: NodeJS.Timeout | undefined;
  let retryDelayMs = 60_000;
  const controller = new AbortController();
  const endpoint = new URL(
    automatic ? '/api/v1/server-registry/announcements'
      : `/api/v1/server-registry/instances/${encodeURIComponent(instanceId!)}/heartbeat`,
    env.OMI_SERVER_REGISTRY_ORIGIN,
  );

  const sendHeartbeat = async (): Promise<void> => {
    if (stopped) return;
    try {
      if (localRegistry) {
        await refreshLocalRegistryEntry();
      } else {
        const response = await fetch(endpoint, {
          method: 'POST',
          redirect: 'error',
          headers: {
            ...(automatic ? {} : { Authorization: `Bearer ${heartbeatToken}` }),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(automatic ? {origin: identity!.origin} : {
            softwareVersion: env.OMI_SERVER_REGISTRY_SOFTWARE_VERSION ?? 'unknown',
            capabilities: env.OMI_SERVER_REGISTRY_CAPABILITIES
              .split(',')
              .map((value) => value.trim())
              .filter(Boolean),
          }),
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(automatic ? 15_000 : 8_000)]),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
      }
      retryDelayMs = 60_000;
      if (!stopped) timer = setTimeout(() => { void sendHeartbeat(); }, HEARTBEAT_INTERVAL_MS - Math.floor(Math.random() * 30_000));
    } catch (error) {
      if (stopped) return;
      console.warn('Studio server registry heartbeat failed; retrying later.', error);
      timer = setTimeout(() => { void sendHeartbeat(); }, retryDelayMs + Math.floor(Math.random() * 5_000));
      retryDelayMs = Math.min(retryDelayMs * 2, MAX_RETRY_DELAY_MS);
    }
  };

  timer = setTimeout(() => { void sendHeartbeat(); }, localRegistry ? 0 : Math.floor(Math.random() * 30_000));
  return () => {
    stopped = true;
    controller.abort();
    if (timer) clearTimeout(timer);
  };
}
