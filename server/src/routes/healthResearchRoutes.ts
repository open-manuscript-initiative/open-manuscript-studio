import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { z } from 'zod';
import { searchHealthResearch } from '../integrations/healthResearch/search.js';
import { requireModuleCapability } from '../middleware/requireModuleCapability.js';
import { requireSession } from '../middleware/requireSession.js';

export const healthResearchRouter = Router();
const bodySchema = z.object({
  provider: z.enum(['pubmed', 'europe-pmc', 'clinical-trials']),
  query: z.string().trim().min(2).max(240),
  cursor: z.string().min(1).max(1024).regex(/^[A-Za-z0-9+/_=.-]+$/).optional(),
}).strict();
const searchLimit = rateLimit({ windowMs: 60_000, limit: 24, standardHeaders: 'draft-8', legacyHeaders: false });
for (const discipline of ['psychology', 'medical-sciences'] as const) {
  healthResearchRouter.post(`/modules/${discipline}/health/search`, requireSession,
    requireModuleCapability(`org.omi.${discipline}`, 'health-research.search'), searchLimit,
    async (request, response) => {
      const parsed = bodySchema.safeParse(request.body);
      if (!parsed.success || (parsed.data.provider === 'pubmed' && parsed.data.cursor !== undefined && (!/^\d{1,4}$/.test(parsed.data.cursor) || Number(parsed.data.cursor) > 9988))) {
        response.status(400).json({ error: { code: 'INVALID_HEALTH_SEARCH', message: 'Enter a valid provider, search term and cursor.' } }); return;
      }
      response.setHeader('Cache-Control', 'no-store');
      try { response.json(await searchHealthResearch(parsed.data)); }
      catch { response.status(502).json({ error: { code: 'HEALTH_SEARCH_FAILED', message: 'The selected research database is temporarily unavailable.' } }); }
    });
}
