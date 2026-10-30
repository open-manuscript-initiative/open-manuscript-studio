import { getTranslationModel, translationProgress } from '../model/translation';
import type { OmiManuscript } from '../types/omi';
import { buildStructuredTranslationPlan } from '../integrations/structuredExternalContent';

/** A portable, accessible aligned-text proof, independent of publication styling. */
export function renderTranslationHtml(manuscript: OmiManuscript, variantId: string, mode: 'parallel' | 'target'): string {
  const variant = getTranslationModel(manuscript).variants.find((item) => item.id === variantId);
  if (!variant || !translationProgress(manuscript, variant).ready) throw new Error('Review and synchronize every translation segment before exporting.');
  const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
  const title = variant.alignments.find((item) => item.sourceAnchor === 'front:title')?.targetText ?? manuscript.title;
  const byAnchor = new Map(variant.alignments.map((item) => [item.sourceAnchor, item]));
  // Follow the live source order, including reorders since the translation was created.
  const units = buildStructuredTranslationPlan(manuscript, variant.scope).segments;
  const rows = units.map((unit) => {
    const item = byAnchor.get(unit.id)!;
    const target = `<div lang="${escape(variant.targetLanguage)}" dir="auto">${escape(item.targetText)}</div>`;
    return `<section class="alignment" data-source-anchor="${escape(item.sourceAnchor)}">${mode === 'parallel' ? `<div lang="${escape(variant.sourceLanguage)}" dir="auto">${escape(item.sourceText)}</div>` : ''}${target}</section>`;
  }).join('\n');
  return `<!doctype html>
<html lang="${escape(variant.targetLanguage)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escape(title)}</title>
<meta name="omi-source-manuscript" content="${escape(manuscript.id)}"><meta name="omi-translation" content="${escape(variant.id)}">
<style>body{max-width:72rem;margin:2rem auto;padding:0 1rem;font:1.1rem/1.6 system-ui}.alignment{display:grid;grid-template-columns:${mode === 'parallel' ? '1fr 1fr' : '1fr'};gap:1.5rem;border-bottom:1px solid #ddd;padding:1rem 0;break-inside:avoid}.alignment div{white-space:pre-wrap;overflow-wrap:anywhere}@media(max-width:40rem){.alignment{grid-template-columns:1fr}}</style></head>
<body><main data-translation-scope="${escape(variant.scope.kind)}">${rows}</main></body></html>`;
}
