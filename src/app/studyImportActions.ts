import { useStudioStore } from './useStudioStore';
import { mergeOmiDocumentAsStudy } from '../model/studyImport';
import { getDocumentStructureProfile } from '../model/documentProfile';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import { putAssetPayload } from '../services/assetRepository';
import { readOmiStudyImportSource } from '../services/omiStudyImport';

export interface ImportedOmiStudy {
  rootSectionId: string;
  title: string;
  sectionCount: number;
  contributorCount: number;
}

/** Imports one OMI file into the current volume without replacing the volume. */
export async function importOmiDocumentAsStudy(
  file: File,
): Promise<ImportedOmiStudy> {
  const source = await readOmiStudyImportSource(file);
  const initial = useStudioStore.getState();
  const baseManuscript = initial.manuscript;
  if (getDocumentStructureProfile(baseManuscript).kind !== 'volume') {
    throw new Error('An OMI document can be inserted as a study only inside an OMI volume.');
  }
  const merged = mergeOmiDocumentAsStudy(
    extractManuscriptState(baseManuscript),
    source.manuscript,
    { sourceFileName: source.fileName },
  );

  for (const packagedAsset of source.packagedAssets) {
    const importedAssetId = merged.assetIdMap.get(packagedAsset.metadata.id);
    if (!importedAssetId) continue;
    await putAssetPayload(baseManuscript.id, importedAssetId, packagedAsset.bytes);
  }

  if (useStudioStore.getState().manuscript !== baseManuscript) {
    throw new Error('The volume changed while the OMI study was being prepared. Please import it again.');
  }

  const timestamp = new Date().toISOString();
  let applied = false;
  useStudioStore.setState((state) => {
    if (state.manuscript !== baseManuscript) return state;

    const firstSectionIndex = state.manuscript.sections.length;
    const events = [
      ...merged.importedSections.map((section, index) => ({
        operation: 'section.create' as const,
        targetId: section.id,
        path: `/sections/${firstSectionIndex + index}`,
        nextValue: section,
      })),
      ...merged.importedAgents.map((agent) => ({
        operation: 'agent.create' as const,
        targetId: agent.id,
        path: '/agents/-',
        nextValue: agent,
      })),
      ...merged.importedContributions.map((contribution) => ({
        operation: 'contribution.update' as const,
        targetId: contribution.id,
        path: '/contributions/-',
        nextValue: contribution,
      })),
    ];
    const pendingChangeSet = stagePendingChanges(
      state.pendingChangeSet,
      {
        baseRevisionId: state.manuscript.headRevisionId,
        summary: 'Imported OMI document as manuscript study',
        events,
        timestamp,
      },
    );

    applied = true;
    return {
      manuscript: {
        ...state.manuscript,
        ...merged.state,
        updatedAt: timestamp,
      },
      pendingChangeSet,
      selectedSectionId: merged.rootSectionId,
    };
  });

  if (!applied) {
    throw new Error('The OMI study could not be inserted because the volume changed.');
  }

  useStudioStore.getState().checkpoint('manual');
  return {
    rootSectionId: merged.rootSectionId,
    title: merged.importedSections[0]?.title ?? source.manuscript.title,
    sectionCount: merged.importedSections.length,
    contributorCount: merged.importedContributions.length,
  };
}
