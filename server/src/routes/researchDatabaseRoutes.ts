import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { searchResearchDatabase } from '../integrations/researchDatabases/search.js';
import { requireModuleCapability, type StudioModuleId } from '../middleware/requireModuleCapability.js';
import { requireSession } from '../middleware/requireSession.js';

export const researchDatabaseRouter = Router();
const bodySchema = z.object({
  provider: z.enum(['eric', 'inspire-hep', 'pubchem', 'gbif', 'openalex', 'sciencebase']),
  query: z.string().trim().min(2).max(240),
  cursor: z.string().regex(/^\d{1,6}$/).optional(),
}).strict();
const searchLimit = rateLimit({ windowMs: 60_000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false });
const moduleProviders: { module: string; moduleId: StudioModuleId; providers: readonly ('eric' | 'inspire-hep' | 'pubchem' | 'gbif' | 'openalex' | 'sciencebase')[] }[] = [
  { module: 'social-research-methods', moduleId: 'org.omi.social-research-methods', providers: ['eric', 'openalex'] },
  { module: 'critical-text-edition', moduleId: 'org.omi.critical-text-edition', providers: ['openalex'] },
  { module: 'experimental-laboratory', moduleId: 'org.omi.experimental-laboratory', providers: ['inspire-hep', 'pubchem', 'gbif', 'openalex', 'sciencebase'] },
];
for (const { module, moduleId, providers } of moduleProviders) {
  researchDatabaseRouter.post(`/modules/${module}/research-databases/search`, requireSession,
    requireModuleCapability(moduleId, 'research-databases.search'),
    searchLimit, async (request, response) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success || !providers.includes(parsed.data.provider)) {
        response.status(400).json({ error: { code: 'INVALID_RESEARCH_DATABASE_SEARCH', message: 'Enter a supported database, query and cursor.' } }); return;
      }
      response.setHeader('Cache-Control', 'no-store');
      const { provider, query, cursor } = parsed.data;
      const searchInput = cursor === undefined ? { provider, query } : { provider, query, cursor };
      try { response.status(200).json(await searchResearchDatabase(searchInput)); }
      catch { response.status(502).json({ error: { code: 'RESEARCH_DATABASE_SEARCH_FAILED', message: 'The selected research database is temporarily unavailable.' } }); }
    });
}
