import type { OmiManuscript } from '../types/omi';

/** No implicit citation, licence claim or private provenance in public artifacts. */
export function sourceAttributionLossDiagnostics(manuscript: OmiManuscript, format: 'HTML' | 'JATS' | 'ODT') {
  return (manuscript.sourceAttributions ?? []).map(relation => ({
    code: 'source-attribution-not-preserved',
    severity: 'warning' as const,
    targetId: relation.id,
    message: `${format} output does not preserve this structured OMI source-attribution relationship. The portable OMI document retains it; visible source text is not a substitute for the relationship.`,
  }));
}
