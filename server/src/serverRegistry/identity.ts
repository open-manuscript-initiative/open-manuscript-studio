import {readFileSync} from 'node:fs';
import {env} from '../config/env.js';
import {normalizePublicOrigin} from './publicOrigin.js';
import {DIRECTORY_PROTOCOL} from './policy.js';

export function publicServerIdentity(challenge: unknown) {
  if (!env.OMI_SERVER_REGISTRY_AUTOMATIC_DISCOVERY || env.NODE_ENV !== 'production' ||
      typeof challenge !== 'string' || !/^[a-f0-9]{64}$/.test(challenge)) return null;
  try {
    const {origin, hostname} = normalizePublicOrigin(env.FRONTEND_ORIGIN);
    let version = env.OMI_SERVER_REGISTRY_SOFTWARE_VERSION;
    if (!version) {
      try { version = (JSON.parse(readFileSync(new URL('../../../package.json', import.meta.url), 'utf8')) as {version: string}).version; }
      catch { version = 'unknown'; }
    }
    return {
      protocol: DIRECTORY_PROTOCOL,
      challenge,
      origin,
      name: (env.INSTITUTIONAL_NAME || `Open Manuscript Studio – ${hostname}`).slice(0, 100),
      softwareVersion: version ?? 'unknown',
      capabilities: env.OMI_SERVER_REGISTRY_CAPABILITIES.split(',').map(value => value.trim()).filter(Boolean).slice(0, 40),
    };
  } catch { return null; }
}
