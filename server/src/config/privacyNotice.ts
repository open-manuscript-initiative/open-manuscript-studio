import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { z } from 'zod';

const text = z.string().trim().min(1).max(8000);
const publicUrl = z.string().url().max(2048).refine((value) => {
  const url = new URL(value);
  return url.protocol === 'https:' && !url.username && !url.password;
}, 'A public HTTPS URL without credentials is required.');

// This file is public information, not an environment/configuration dump.
// Strict schemas prevent accidentally publishing an added secret property.
export const privacyNoticeSchema = z.object({
  version: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  language: z.string().min(2).max(16),
  operatorReviewed: z.literal(true),
  controller: z.object({ name: text, postalAddress: text, email: z.string().email(),
    dpoEmail: z.string().email().optional() }).strict(),
  noticeUrl: publicUrl,
  authority: z.object({ name: text, url: publicUrl }).strict(),
  processing: z.array(z.object({ purpose: text, categories: text, legalBasis: text,
    retention: text, recipients: text, internationalTransfers: text }).strict()).min(1).max(30),
  rights: text,
  dataSources: text,
  requiredData: text,
  automatedDecisions: text,
  cookies: text,
  backups: text,
  deletion: text,
}).strict();

export type PrivacyNotice = z.infer<typeof privacyNoticeSchema>;
export type PublicPrivacyNotice = { configured: false } | { configured: true; notice: PrivacyNotice };

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
