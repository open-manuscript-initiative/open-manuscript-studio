/** DTP/CSS absolute units: 1 in = 25.4 mm = 72 pt = 6 pc. */
export const PUBLICATION_MEASUREMENT_UNITS = ['mm', 'pc', 'pt'] as const;
export type PublicationMeasurementUnit = typeof PUBLICATION_MEASUREMENT_UNITS[number];
const MM_PER_UNIT = { mm: 1, pc: 25.4 / 6, pt: 25.4 / 72 } as const;

export function isPublicationMeasurementUnit(value: unknown): value is PublicationMeasurementUnit {
  return value === 'mm' || value === 'pc' || value === 'pt';
}
export function publicationMeasurementFromMm(value: number, unit: PublicationMeasurementUnit): number {
  return value / MM_PER_UNIT[unit];
}
export function publicationMeasurementToMm(value: number, unit: PublicationMeasurementUnit): number {
  return value * MM_PER_UNIT[unit];
}
export function formatPublicationMeasurement(valueMm: number, unit: PublicationMeasurementUnit): string {
  // Significant digits also retain very small image sizes and negative offsets.
  return String(Number(publicationMeasurementFromMm(valueMm, unit).toPrecision(12)));
}
export function parsePublicationMeasurement(draft: string, unit: PublicationMeasurementUnit, minMm: number, maxMm: number): number | undefined {
  if (!draft.trim()) return undefined;
  const value = publicationMeasurementToMm(Number(draft), unit);
  if (!Number.isFinite(value)) return undefined;
  // Display rounding at a boundary must not make an otherwise valid size invalid.
  const lowerTolerance = Math.max(Math.abs(value), Math.abs(minMm), 1) * 1e-11;
  const upperTolerance = Math.max(Math.abs(value), Math.abs(maxMm), 1) * 1e-11;
  if (value < minMm - lowerTolerance || value > maxMm + upperTolerance) return undefined;
  if (Math.abs(value - minMm) <= lowerTolerance) return minMm;
  if (Math.abs(value - maxMm) <= upperTolerance) return maxMm;
  return value;
}
