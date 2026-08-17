import fs from 'node:fs/promises';
import path from 'node:path';

export async function loadTranslationOverlay(root, locale) {
  const file = path.join(root, 'locale', 'completion-overlays', `${locale}.json`);
  try {
    const payload = JSON.parse(await fs.readFile(file, 'utf8'));
    if (payload.locale !== locale) throw new Error(`${locale}: overlay locale mismatch.`);
    return {
      bySource: new Map(Object.entries(payload.bySource ?? {})),
      byPointer: new Map(Object.entries(payload.byPointer ?? {})),
    };
  } catch (error) {
    if (error?.code === 'ENOENT') return { bySource: new Map(), byPointer: new Map() };
    throw error;
  }
}

export function resolveReviewedTranslation({ locale, pointer, source, current, overlay }) {
  if (locale === 'en' || current !== source) {
    return { value: current, reviewedByOverlay: false };
  }

  const pointerValue = overlay.byPointer.get(pointer);
  if (typeof pointerValue === 'string' && pointerValue.trim()) {
    return { value: pointerValue, reviewedByOverlay: true };
  }

  const sourceValue = overlay.bySource.get(source);
  if (typeof sourceValue === 'string' && sourceValue.trim()) {
    return { value: sourceValue, reviewedByOverlay: true };
  }

  return { value: current, reviewedByOverlay: false };
}
