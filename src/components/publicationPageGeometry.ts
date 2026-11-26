import type { createPublicationPageStyleResolver } from '../model/publicationPageStyles';

const PIXELS_PER_MM = 96 / 25.4;

export function canvasPageGeometry(resolved: ReturnType<ReturnType<typeof createPublicationPageStyleResolver>['resolve']>, scale: number) {
  const p = resolved.page, unit = PIXELS_PER_MM * scale;
  const inner = (p.margins.inner + p.gutter) * unit, outer = p.margins.outer * unit;
  const mirrored = p.mirroredMargins && resolved.pageNumber % 2 === 0;
  const width = p.width * unit, height = p.height * unit;
  const topMargin = p.margins.top * unit, bottomMargin = p.margins.bottom * unit;
  return { width, height, topMargin, bottomMargin, left: mirrored ? outer : inner, right: mirrored ? inner : outer,
    bodyHeight: Math.max(10 * unit, height - topMargin - bottomMargin), bodyWidth: Math.max(10 * unit, width - inner - outer) };
}
