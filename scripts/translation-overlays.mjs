import fs from 'node:fs/promises';
import path from 'node:path';

const overlayDir = (root) => path.join(root, 'locale', 'completion-overlays');

export async function loadTranslationOverlay(root, locale) {
  const bySource = new Map();
  const byPointer = new Map();
  let files = [];
  try {
    files = await fs.readdir(overlayDir(root));
  } catch (error) {
    if (error?.code === 'ENOENT') return { bySource, byPointer };
    throw error;
  }

  const matching = files
    .filter((name) => name === `${locale}.json` || (name.startsWith(`${locale}.`) && name.endsWith('.json')))
    .sort();

  for (const name of matching) {
    const payload = JSON.parse(await fs.readFile(path.join(overlayDir(root), name), 'utf8'));
    if (payload.locale !== locale) throw new Error(`${locale}: overlay locale mismatch in ${name}.`);
    for (const [key, value] of Object.entries(payload.bySource ?? {})) bySource.set(key, value);
    for (const [key, value] of Object.entries(payload.byPointer ?? {})) byPointer.set(key, value);
  }

  return { bySource, byPointer };
}

export async function loadCompletionOverlayStatus(root) {
  try {
    const payload = JSON.parse(await fs.readFile(path.join(overlayDir(root), 'status.json'), 'utf8'));
    return new Set(payload.completeLocales ?? []);
  } catch (error) {
    if (error?.code === 'ENOENT') return new Set();
    throw error;
  }
}

export function resolveReviewedTranslation({ locale, pointer, source, current, overlay }) {
  if (locale === 'en' || current !== source) return { value: current, reviewedByOverlay: false };

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
