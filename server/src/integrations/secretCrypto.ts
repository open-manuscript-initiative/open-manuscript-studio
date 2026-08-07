import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from 'node:crypto';

import { env } from '../config/env.js';

function masterKey(): Buffer {
  return Buffer.from(
    env.INTEGRATION_MASTER_KEY,
    'hex',
  );
}

export interface EncryptedSecret {
  ciphertext: string;
  iv: string;
  authTag: string;
}

export function encryptSecret(
  plaintext: string,
): EncryptedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv(
    'aes-256-gcm',
    masterKey(),
    iv,
  );

  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString('base64url'),
    iv: iv.toString('base64url'),
    authTag: cipher
      .getAuthTag()
      .toString('base64url'),
  };
}

export function decryptSecret(
  secret: EncryptedSecret,
): string {
  const decipher = createDecipheriv(
    'aes-256-gcm',
    masterKey(),
    Buffer.from(secret.iv, 'base64url'),
  );

  decipher.setAuthTag(
    Buffer.from(secret.authTag, 'base64url'),
  );

  return Buffer.concat([
    decipher.update(
      Buffer.from(
        secret.ciphertext,
        'base64url',
      ),
    ),
    decipher.final(),
  ]).toString('utf8');
}
