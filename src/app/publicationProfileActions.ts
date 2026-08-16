import { useStudioStore } from './useStudioStore';
import { synchronizeCrossReferenceLabels } from '../model/crossReferences';
import { getExternalIdentifierValue } from '../model/identity';
import {
  applyPublicationProfileDefaults,
  createPublicationProfileReference,
  getPublicationProfile,
  getPublicationProfileReference,
  type OmiPublicationProfile,
} from '../model/publicationProfile';
import { extractManuscriptState } from '../model/versioning';
import { stagePendingChanges } from '../model/workingState';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import type { OmiManuscript, OmiSection } from '../types/omi';

const PUBLICATION_PROFILE_CHECKPOINT_DELAY_MS = 2500;
let publicationProfileCheckpointTimer: ReturnType<typeof setTimeout> | null = null;

/** Apply either a built-in profile id or a complete portable custom profile. */
export function stagePublicationProfileChange(profileOrId: string | OmiPublicationProfile): boolean {
  const profile = typeof profileOrId === 'string'
    ? getPublicationProfile(profileOrId)
    : profileOrId;
  if (!profile) return false;

  let changed = false;
  useStudioStore.setState((state) => {
    const previousReference = getPublicationProfileReference(state.manuscript);
    const nextReference = createPublicationProfileReference(profile);
    const previousPortableState = extractManuscriptState(state.manuscript);
    const stateWithDefaults = applyPublicationProfileDefaults(previousPortableState, profile);
    const nextSections = synchronizeCrossReferenceLabels(
      stateWithDefaults.sections,
      stateWithDefaults.crossReferences ?? [],
      profile.rules.objects.numbering,
      stateWithDefaults.locale,
    );

    const sameReference = previousReference?.id === nextReference.id && previousReference?.version === nextReference.version;
    const sameEmbedded = JSON.stringify(state.manuscript.embeddedPublicationProfile ?? null) === JSON.stringify(stateWithDefaults.embeddedPublicationProfile ?? null);
    const sameSectionNumbering = (state.manuscript.sectionNumberingStyle ?? 'none') === profile.rules.sections.numberingStyle;
    const sameCitationStyle = (state.manuscript.citationStyle ?? 'apa-7') === profile.rules.citations.style;
    const sameObjectNumbering = (state.manuscript.crossReferenceNumbering ?? 'document') === profile.rules.objects.numbering;
    const blockEvents = collectBlockContentChanges(state.manuscript.sections, nextSections);

    if (sameReference && sameEmbedded && sameSectionNumbering && sameCitationStyle && sameObjectNumbering && blockEvents.length === 0) return state;

    const events = [];
    if (!sameReference || !sameEmbedded) {
      events.push({
        operation: 'publication.profile.set' as never,
        targetId: state.manuscript.id,
        path: '/publicationProfile',
        previousValue: previousReference,
        nextValue: nextReference,
      });
    }
    if (!sameSectionNumbering) events.push({ operation: 'manuscript.sectionNumbering.set' as never, targetId: state.manuscript.id, path: '/sectionNumberingStyle', previousValue: state.manuscript.sectionNumberingStyle ?? 'none', nextValue: profile.rules.sections.numberingStyle });
    if (!sameCitationStyle) events.push({ operation: 'citation.style.set' as never, targetId: state.manuscript.id, path: '/citationStyle', previousValue: state.manuscript.citationStyle ?? 'apa-7', nextValue: profile.rules.citations.style });
    if (!sameObjectNumbering) events.push({ operation: 'crossReference.numbering.set' as never, targetId: state.manuscript.id, path: '/crossReferenceNumbering', previousValue: state.manuscript.crossReferenceNumbering ?? 'document', nextValue: profile.rules.objects.numbering });
    events.push(...blockEvents);

    const timestamp = new Date().toISOString();
    const pendingChangeSet = stagePendingChanges(state.pendingChangeSet, {
      baseRevisionId: state.manuscript.headRevisionId,
      summary: `Applied publication profile ${profile.id}@${profile.version}`,
      events,
      actorAgentId: resolveCurrentActorAgentId(state.manuscript),
      timestamp,
    });

    changed = true;
    return {
      manuscript: { ...state.manuscript, ...stateWithDefaults, sections: nextSections, updatedAt: timestamp },
      pendingChangeSet,
    };
  });

  if (changed) schedulePublicationProfileCheckpoint();
  return changed;
}

function collectBlockContentChanges(previousSections: readonly OmiSection[], nextSections: readonly OmiSection[]) {
  const previousBlocks = new Map(previousSections.flatMap((section) => section.blocks).map((block) => [block.id, block]));
  return nextSections.flatMap((section) => section.blocks).flatMap((block) => {
    const previous = previousBlocks.get(block.id);
    if (!previous || previous.content === block.content) return [];
    return [{ operation: 'block.content.set' as const, targetId: block.id, path: `/blocks/${block.id}/content`, previousValue: previous.content, nextValue: block.content }];
  });
}

function schedulePublicationProfileCheckpoint(): void {
  if (publicationProfileCheckpointTimer !== null) clearTimeout(publicationProfileCheckpointTimer);
  publicationProfileCheckpointTimer = setTimeout(() => {
    publicationProfileCheckpointTimer = null;
    useStudioStore.getState().checkpoint('idle');
  }, PUBLICATION_PROFILE_CHECKPOINT_DELAY_MS);
}

function resolveCurrentActorAgentId(manuscript: OmiManuscript): string | undefined {
  const currentUser = getCurrentUser(useAuthStore.getState());
  if (!currentUser) return undefined;
  if (currentUser.agentId && manuscript.agents.some((agent) => agent.id === currentUser.agentId)) return currentUser.agentId;
  const accountOrcid = normalizeOrcidForComparison(currentUser.profile.orcid);
  if (!accountOrcid) return undefined;
  const matches = manuscript.agents.filter((agent) => normalizeOrcidForComparison(getExternalIdentifierValue(agent, 'orcid')) === accountOrcid);
  return matches.length === 1 ? matches[0]?.id : undefined;
}

function normalizeOrcidForComparison(value: string | undefined): string {
  return (value ?? '').trim().replace(/^https?:\/\/orcid\.org\//i, '').toUpperCase();
}
