import { z } from 'zod';
import { workflowRolePreferences } from '../services/workflowRolePreference.js';

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
export const publicPrivacyNoticeSchema = z.discriminatedUnion('configured', [
  z.object({ configured: z.literal(false) }).strict(),
  z.object({ configured: z.literal(true), notice: privacyNoticeSchema }).strict(),
]);
export type PublicPrivacyNotice = z.infer<typeof publicPrivacyNoticeSchema>;

export const accountSectionNames = ['profileEmails', 'identities', 'institutionMemberships', 'sessions', 'passkeys'] as const;
export const accountOverviewLimit = 1000;
const timestamp = z.iso.datetime();
const nullableText = z.string().nullable();
export const accountOverviewSchema = z.object({
  schema: z.literal('omi-account-overview/1'), exportedAt: timestamp,
  scope: z.string(), omitted: z.array(z.string()).min(1),
  incompleteSections: z.array(z.enum(accountSectionNames)),
  profile: z.object({
    id: z.string(), email: z.string(), fullName: z.string(), affiliation: nullableText,
    affiliationRorId: nullableText, country: nullableText, website: nullableText,
    orcid: nullableText, bio: nullableText, timeZone: nullableText,
    interfaceLanguage: z.string(), status: z.enum(['PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED']),
    createdAt: timestamp, updatedAt: timestamp, lastLoginAt: timestamp.nullable(),
    workflowRole: z.enum(workflowRolePreferences),
  }).strict(),
  profileEmails: z.array(z.object({ email: z.string(), isPrimary: z.boolean(), createdAt: timestamp }).strict()).max(accountOverviewLimit),
  identities: z.array(z.object({ provider: z.string(), issuer: z.string(), subject: z.string(),
    displayName: nullableText, createdAt: timestamp, lastUsedAt: timestamp.nullable() }).strict()).max(accountOverviewLimit),
  institutionMemberships: z.array(z.object({ role: z.string(), createdAt: timestamp,
    institution: z.object({ name: z.string() }).strict() }).strict()).max(accountOverviewLimit),
  sessions: z.array(z.object({ createdAt: timestamp, expiresAt: timestamp }).strict()).max(accountOverviewLimit),
  passkeys: z.array(z.object({ label: z.string(), deviceType: z.string(), backedUp: z.boolean(),
    createdAt: timestamp, lastUsedAt: timestamp.nullable() }).strict()).max(accountOverviewLimit),
}).strict();
export type AccountOverview = z.infer<typeof accountOverviewSchema>;
export const privacyErrorSchema = z.object({ error: z.object({
  code: z.enum(['NOT_AUTHENTICATED', 'ACCOUNT_NOT_FOUND', 'RATE_LIMITED', 'ACCOUNT_EXPORT_FAILED', 'IDENTITY_UNAVAILABLE']),
  message: z.string(),
}).strict() }).strict();
export type PrivacyError = z.infer<typeof privacyErrorSchema>;
