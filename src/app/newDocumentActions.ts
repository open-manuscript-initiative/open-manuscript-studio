import { clearDocumentClosedState } from './documentCloseState';
import { useStudioStore } from './useStudioStore';
import { createBlankManuscript, type CreateBlankManuscriptInput } from '../document/createBlankManuscript';
import { getCurrentUser, useAuthStore } from '../store/authStore';
import type { OmiDocumentKind, OmiVolumeKind } from '../model/documentProfile';
import type { OmiManuscript } from '../types/omi';
import type { PublicationTemplate } from '../model/publicationTemplates';
import { hydratePublicationTemplateAssets, validatePublicationTemplate } from '../services/publicationTemplates';

interface NewDocumentInput {
  kind: OmiDocumentKind;
  volumeKind?: OmiVolumeKind;
  locale: string;
  publicationKind?: CreateBlankManuscriptInput['publicationKind'];
  title?: string;
  titleMatter?: CreateBlankManuscriptInput['titleMatter'];
  publicationTemplate?: PublicationTemplate;
}

export function createAndOpenBlankOmiDocument(input: NewDocumentInput): OmiManuscript {
  const manuscript = createForCurrentUser(input);
  openCreatedManuscript(manuscript);
  return manuscript;
}

export async function createAndOpenPublicationFromTemplate(input: NewDocumentInput, template: PublicationTemplate): Promise<OmiManuscript> {
  const previousId = useStudioStore.getState().manuscript.id;
  const validated = await validatePublicationTemplate(template);
  const manuscript = createForCurrentUser({ ...input, publicationTemplate: validated });
  await hydratePublicationTemplateAssets(manuscript.id, validated);
  if (useStudioStore.getState().manuscript.id !== previousId) throw new Error('The active document changed.');
  openCreatedManuscript(manuscript);
  return manuscript;
}

function openCreatedManuscript(manuscript: OmiManuscript): void {
  if (useStudioStore.getState().hasOpenDocument) {
    useStudioStore.getState().checkpoint('manual');
  }
  clearDocumentClosedState();
  useStudioStore.getState().loadManuscript(manuscript);
}

function createForCurrentUser(input: NewDocumentInput): OmiManuscript {
  const user = getCurrentUser(useAuthStore.getState());
  const fullName = user?.profile.fullName.trim() ?? '';
  const [givenName = '', ...familyNameParts] = fullName.split(/\s+/u).filter(Boolean);
  return createBlankManuscript({
    ...input,
    author: user && fullName ? {
      givenName,
      familyName: familyNameParts.join(' '),
      displayName: fullName,
      preferredPublicName: fullName,
      email: user.email,
      affiliation: user.profile.affiliation,
      affiliationRorId: user.profile.affiliationRorId,
      country: user.profile.country,
      url: user.profile.website,
      orcid: user.profile.orcid,
      biography: user.profile.bio
        ? { [input.locale]: user.profile.bio }
        : undefined,
    } : undefined,
  });
}
