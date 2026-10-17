import type { TranskribusModel } from './api';

export function transkribusLanguageName(code: string, locale: string): string {
  try { return new Intl.DisplayNames([locale, 'en'], { type: 'language' }).of(code) ?? code; }
  catch { return code; }
}

const fold = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();

export function filterTranskribusModels(models: readonly TranskribusModel[],
  filters: { query: string; language: string; material: string }, locale: string,
): TranskribusModel[] {
  const terms = fold(filters.query.trim()).split(/\s+/).filter(Boolean);
  return models.filter(model => {
    if (filters.language && !model.languages.includes(filters.language)) return false;
    if (filters.material && model.material !== filters.material) return false;
    const text = fold([model.name, model.creator, model.modelId, ...model.scripts, ...model.centuries,
      ...model.languages.flatMap(code => [code, transkribusLanguageName(code, locale)])].join(' '));
    return terms.every(term => text.includes(term));
  });
}
