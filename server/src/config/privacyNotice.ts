import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';

import { privacyNoticeSchema, type PublicPrivacyNotice } from '../contracts/privacyContract.js';
export { privacyNoticeSchema } from '../contracts/privacyContract.js';
export type { PrivacyNotice, PublicPrivacyNotice } from '../contracts/privacyContract.js';

export function loadPrivacyNotice(path: string | undefined): PublicPrivacyNotice {
  if (!path) return { configured: false };
  try {
    if (!isAbsolute(path) || statSync(path).size > 128 * 1024) throw new Error('invalid file');
    return { configured: true, notice: privacyNoticeSchema.parse(JSON.parse(readFileSync(path, 'utf8'))) };
  } catch {
    // Never log the path, input, Zod values or secrets accidentally pasted here.
    throw new Error('OMI_PRIVACY_CONFIG_PATH must reference a valid reviewed public privacy JSON file (maximum 128 KiB).');
  }
}
