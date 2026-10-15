import { identityPrisma } from '../lib/identityPrisma.js';

/** Passkey persistence port; backed by the authoritative identity database. */
export type PasskeyRepository = Pick<typeof identityPrisma, 'user' | 'userPasskey' | 'passkeyChallenge'>;
export const passkeyRepository: PasskeyRepository = identityPrisma;
