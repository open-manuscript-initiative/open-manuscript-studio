import {createHash, randomBytes} from 'node:crypto';
import {env} from '../config/env.js';
import {serverRegistryRepository} from '../repositories/serverRegistryRepository.js';
import {publicServerIdentity} from './identity.js';

export async function refreshLocalRegistryEntry(): Promise<void> {
  const challenge = randomBytes(32).toString('hex');
  const identity = publicServerIdentity(challenge);
  if (!identity || identity.origin !== new URL(env.OMI_SERVER_REGISTRY_ORIGIN).origin) {
    throw new Error('Only the registry host may refresh its own local entry.');
  }
  const changed = await serverRegistryRepository.observe(identity.origin, {
    name: identity.name,
    hostname: new URL(identity.origin).hostname,
    softwareVersion: identity.softwareVersion,
    capabilities: identity.capabilities,
    domainChallengeHash: createHash('sha256').update(challenge).digest('hex'),
  }, randomBytes(16).toString('hex'), createHash('sha256').update(randomBytes(32)).digest('hex'));
  if (!changed) throw new Error('The registry host entry is revoked or quarantined.');
}
