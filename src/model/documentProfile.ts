import type { OmiManuscriptState } from '../types/omi';

export type OmiDocumentKind = 'study' | 'volume';
export type OmiVolumeKind = 'monograph' | 'edited-volume';
export type OmiNoteNumberingScope = 'continuous' | 'study' | 'section';
export type OmiBackMatterPlacement = 'study-end' | 'volume-end';

export interface OmiDocumentStructureProfile {
  modelVersion: '0.1.0-alpha.1';
  kind: OmiDocumentKind;
  volumeKind?: OmiVolumeKind;
  noteNumberingScope: OmiNoteNumberingScope;
  referencesPlacement: OmiBackMatterPlacement;
  listsPlacement: OmiBackMatterPlacement;
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** Authoring structure for a standalone study, monograph, or edited volume. */
    documentStructure?: OmiDocumentStructureProfile;
  }
}

export function createDocumentStructureProfile(
  kind: OmiDocumentKind,
  volumeKind?: OmiVolumeKind,
): OmiDocumentStructureProfile {
  if (kind === 'study') {
    return {
      modelVersion: '0.1.0-alpha.1',
      kind,
      noteNumberingScope: 'continuous',
      referencesPlacement: 'volume-end',
      listsPlacement: 'volume-end',
    };
  }

  const normalizedVolumeKind = volumeKind ?? 'edited-volume';
  return {
    modelVersion: '0.1.0-alpha.1',
    kind,
    volumeKind: normalizedVolumeKind,
    noteNumberingScope:
      normalizedVolumeKind === 'edited-volume' ? 'study' : 'continuous',
    referencesPlacement:
      normalizedVolumeKind === 'edited-volume' ? 'study-end' : 'volume-end',
    listsPlacement: 'volume-end',
  };
}

/**
 * Legacy documents keep the top-level study editor boundaries without
 * silently changing their previously document-wide scholarly apparatus.
 */
export function getDocumentStructureProfile(
  manuscript: Pick<OmiManuscriptState, 'documentStructure'>,
): OmiDocumentStructureProfile {
  return manuscript.documentStructure
    ? { ...manuscript.documentStructure }
    : {
        modelVersion: '0.1.0-alpha.1',
        kind: 'volume',
        volumeKind: 'edited-volume',
        noteNumberingScope: 'continuous',
        referencesPlacement: 'volume-end',
        listsPlacement: 'volume-end',
      };
}
