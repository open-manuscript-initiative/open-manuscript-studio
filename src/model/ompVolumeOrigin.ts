import type { OmiManuscriptState } from '../types/omi';

/** Canonical OMI-SPEC-320 extension key for new OMP imports. */
export const OMP_VOLUME_ORIGIN = 'urn:omi:studio:omp-volume-origin:1';
export const LEGACY_OMP_VOLUME_ORIGIN = 'org.openmanuscript.omp.volume';

/** Keep already-open legacy documents readable without altering their history.
 * Ambiguous dual-key records are not valid integration targets. */
export function ompVolumeOriginKey(state: OmiManuscriptState): string {
  return state.extensions?.[OMP_VOLUME_ORIGIN] === undefined &&
    state.extensions?.[LEGACY_OMP_VOLUME_ORIGIN] !== undefined ? LEGACY_OMP_VOLUME_ORIGIN : OMP_VOLUME_ORIGIN;
}
export function readOmpVolumeOrigin(state: OmiManuscriptState): unknown {
  if (state.extensions?.[OMP_VOLUME_ORIGIN] !== undefined &&
      state.extensions?.[LEGACY_OMP_VOLUME_ORIGIN] !== undefined) return undefined;
  return state.extensions?.[ompVolumeOriginKey(state)];
}
