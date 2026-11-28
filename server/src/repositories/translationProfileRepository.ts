import { identityPrisma } from '../lib/identityPrisma.js';
import { normalizeTranslationLanguagePairs, type TranslationLanguagePair } from '../services/translationAssignmentPolicy.js';

export async function readTranslationLanguagePairs(userId: string): Promise<TranslationLanguagePair[]> {
  try {
    const user = await identityPrisma.user.findUnique({ where: { id: userId }, select: { translationLanguagePairs: true } });
    return normalizeTranslationLanguagePairs(user?.translationLanguagePairs ?? []);
  } catch (error) {
    const candidate = error as { code?: string; message?: string; meta?: { column?: string } };
    if (candidate.code === 'P2022' && /translation_language_pairs/.test(`${candidate.message ?? ''} ${candidate.meta?.column ?? ''}`)) return [];
    throw error;
  }
}
