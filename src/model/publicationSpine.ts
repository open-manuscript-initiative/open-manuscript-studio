import type { PublicationMatter } from './publicationMatter';

export interface PublicationSpineCalculation {
  mode: 'manual' | 'automatic'; pageCountSource: 'layout' | 'manual'; pageCount: number;
  paperId: string; grammageGsm: number; bulkCm3PerG: number; allowanceMm: number;
}
// Manufacturer target calipers, not generic thicknesses for every paper of a given weight.
export const PUBLICATION_PAPERS = [
  { id: 'amber-80', type: 'uncoated', name: 'Amber Graphic', grammageGsm: 80, thicknessMm: .099, source: 'https://www.arcticpaper.com/our-products/our-brands/amber/amber-graphic/' },
  { id: 'amber-100', type: 'uncoated', name: 'Amber Graphic', grammageGsm: 100, thicknessMm: .122, source: 'https://www.arcticpaper.com/our-products/our-brands/amber/amber-graphic/' },
  { id: 'gprint-90', type: 'coated', name: 'G-Print', grammageGsm: 90, thicknessMm: .087, source: 'https://www.arcticpaper.com/our-products/our-brands/g/g-print/' },
  { id: 'gprint-130', type: 'coated', name: 'G-Print', grammageGsm: 130, thicknessMm: .129, source: 'https://www.arcticpaper.com/our-products/our-brands/g/g-print/' },
  ...[1.5, 1.8, 2].map((bulk) => ({ id: `munken-80-${bulk}`, type: 'book', name: `Munken Print White ${bulk * 10}`, grammageGsm: 80, thicknessMm: 80 * bulk / 1000, source: 'https://www.arcticpaper.com/our-products/our-brands/munken/munken-book-papers/munken-print-white/' })),
] as const;

export function defaultSpineCalculation(pageCount?: number): PublicationSpineCalculation {
  return { mode: 'manual', pageCountSource: pageCount ? 'layout' : 'manual', pageCount: pageCount ?? 1,
    paperId: 'amber-80', grammageGsm: 80, bulkCm3PerG: 1.2375, allowanceMm: 0 };
}
export function paperThicknessMm(value: PublicationSpineCalculation): number {
  return value.grammageGsm * value.bulkCm3PerG / 1000;
}
export function publicationSpineWidth(model: PublicationMatter): number {
  return model.spineCalculation?.mode === 'automatic' ? calculatedSpineWidthMm(model.spineCalculation) : model.spineWidthMm ?? 10;
}
export function calculatedSpineWidthMm(value: PublicationSpineCalculation): number {
  // A printed page is one side of a leaf. Round odd counts up to a whole leaf.
  return Number((Math.ceil(value.pageCount / 2) * paperThicknessMm(value) + value.allowanceMm).toFixed(6));
}
export function publicationInsidePageCount(model: PublicationMatter, bodyPageCount: number): number {
  return bodyPageCount + model.pages.filter((page) => page.enabled && ['half-title', 'series-page', 'title-page', 'imprint-page'].includes(page.kind)).length;
}
export function withPublicationSpineWidth(model: PublicationMatter, width: number): PublicationMatter {
  const delta = width - publicationSpineWidth(model);
  return { ...model, spineWidthMm: width, pages: model.pages.map((page) => page.kind.startsWith('cover-') && page.frames
    ? { ...page, frames: page.frames.map((frame) => frame.coverAnchor === 'right' || frame.coverAnchor === 'spine'
      ? { ...frame, xMm: frame.xMm + delta * (frame.coverAnchor === 'right' ? 1 : .5) } : frame) } : page) };
}
export function synchronizePublicationSpine(model: PublicationMatter, bodyPageCount: number): PublicationMatter {
  const previous = model.spineCalculation;
  if (!previous || previous.mode !== 'automatic' || previous.pageCountSource !== 'layout') return model;
  const pageCount = publicationInsidePageCount(model, bodyPageCount);
  if (pageCount === previous.pageCount) return model;
  const next = { ...previous, pageCount };
  validateSpineCalculation(next);
  return { ...withPublicationSpineWidth(model, calculatedSpineWidthMm(next)), spineCalculation: next };
}
export function validateSpineCalculation(value: unknown): asserts value is PublicationSpineCalculation {
  const v = value as PublicationSpineCalculation;
  const finite = (n: unknown, min: number, max: number) => typeof n === 'number' && Number.isFinite(n) && n >= min && n <= max;
  if (!v || !['manual', 'automatic'].includes(v.mode) || !['layout', 'manual'].includes(v.pageCountSource)
    || !Number.isInteger(v.pageCount) || !finite(v.pageCount, 1, 100000) || typeof v.paperId !== 'string'
    || !['custom', ...PUBLICATION_PAPERS.map((paper) => paper.id)].includes(v.paperId)
    || !finite(v.grammageGsm, 30, 400) || !finite(v.bulkCm3PerG, .2, 5) || !finite(v.allowanceMm, 0, 20)
    || (v.mode === 'automatic' && calculatedSpineWidthMm(v) > 100)) throw new Error('Invalid publication spine calculation.');
}
