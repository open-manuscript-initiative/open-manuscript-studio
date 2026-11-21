import { z } from 'zod';

// The allowed report shape deliberately excludes manuscript IDs/content,
// device identifiers, screenshots, credentials and complete diagnostic logs.
export const studioFeedbackSchema = z.object({
  // Required only for report localization; not a device/browser fingerprint.
  messageLocale: z.string().trim().regex(/^[a-zA-Z]{2,3}(?:[-_][a-zA-Z0-9]{2,8})*$/).max(25).optional(),
  category: z.enum(['bug', 'suggestion', 'test']),
  area: z.enum(['editor', 'import', 'export', 'notes', 'collaboration', 'publishing', 'account', 'other']),
  title: z.string().trim().min(5).max(120),
  description: z.string().trim().min(15).max(4000),
  reproductionSteps: z.string().trim().max(1500).optional(),
  expectedResult: z.string().trim().max(1500).optional(),
  testOutcome: z.enum(['success', 'problem', 'not_applicable']).optional(),
  contactEmail: z.email().trim().max(320).optional(),
  technical: z.object({
    platform: z.enum(['android', 'ios', 'desktop', 'web']),
    appVersion: z.string().trim().max(80),
    locale: z.string().trim().max(25),
  }).strict().optional(),
}).strict();
