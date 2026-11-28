import { readTranslationLanguagePairs } from '../repositories/translationProfileRepository.js';
import { matchesTranslationPair } from './translationAssignmentPolicy.js';

export { readTranslationLanguagePairs };
export async function assertTranslationAssignmentScope(userId: string, assignment: { assignmentType: string; sourceLanguage: string | null; targetLanguage: string | null }): Promise<void> {
  if (assignment.assignmentType !== 'TRANSLATION') return;
  const pairs = await readTranslationLanguagePairs(userId);
  if (!pairs.length) {
    const error = new Error('Configure your translation language pairs in your personal profile before starting.');
    error.name = 'TranslationProfileRequiredError';
    throw error;
  }
  if (!matchesTranslationPair(pairs, assignment.sourceLanguage, assignment.targetLanguage)) {
    const error = new Error('This translation assignment is outside the language pairs configured in your profile.');
    error.name = 'TranslationPairMismatchError';
    throw error;
  }
}
