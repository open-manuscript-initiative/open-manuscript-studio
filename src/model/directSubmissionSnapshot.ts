import { createContribution, createPersonAgent } from './identity';
import type { OmiManuscript } from '../types/omi';
import type { SubmissionAuthor } from '../services/directSubmissionTypes';

/** Export a separate snapshot; preparing a submission never edits the open document. */
export function createDirectSubmissionSnapshot(manuscript: OmiManuscript, metadata: {
  title: string; abstract: string; keywords: string[]; locale: string; authors: SubmissionAuthor[];
}): OmiManuscript {
  const snapshot = structuredClone(manuscript);
  const now = new Date().toISOString();
  snapshot.title = metadata.title;
  snapshot.abstract = metadata.abstract;
  snapshot.keywords = [...metadata.keywords];
  snapshot.locale = metadata.locale;
  snapshot.abstracts = { ...snapshot.abstracts, [metadata.locale]: metadata.abstract };
  snapshot.keywordsByLocale = { ...snapshot.keywordsByLocale, [metadata.locale]: [...metadata.keywords] };
  snapshot.contributions = snapshot.contributions
    .map((contribution) => ({
      ...contribution,
      roles: contribution.roles.filter((role) => role !== 'author'),
    }))
    .filter((contribution) => contribution.roles.length);

  metadata.authors.forEach((author, index) => {
    const old = snapshot.agents.find((agent) => agent.id === author.agentId);
    const agent = createPersonAgent(
      {
        givenName: author.givenName,
        familyName: author.familyName,
        displayName: author.preferredPublicName || undefined,
        language: metadata.locale,
        affiliation: author.affiliation,
        affiliationRorId: author.affiliationRorId,
        department: author.department,
        position: author.position,
        email: author.email,
        country: author.country,
        url: author.url,
        biography: author.biography
          ? { [metadata.locale]: author.biography }
          : undefined,
        orcid: author.orcid,
      },
      old?.id ?? crypto.randomUUID(),
      now,
    );

    const nextAgent = old
      ? {
          ...old,
          ...agent,
          biography: {
            ...(old.biography ?? {}),
            ...(agent.biography ?? {}),
          },
          createdAt: old.createdAt,
          updatedAt: now,
        }
      : agent;

    if (old) {
      snapshot.agents = snapshot.agents.map((candidate) =>
        candidate.id === old.id ? nextAgent : candidate,
      );
    } else {
      snapshot.agents.push(nextAgent);
    }

    const contribution = createContribution(
      nextAgent.id,
      snapshot.id,
      [author.role ?? 'author'],
      index + 1,
      crypto.randomUUID(),
      now,
    );
    contribution.corresponding = author.primaryContact ?? index === 0;
    contribution.attributionName =
      author.preferredPublicName?.trim() || undefined;
    contribution.includeInPublicationList = author.includeInBrowse ?? true;
    contribution.creditRoles = [...(author.creditRoles ?? [])];
    if (author.competingInterestsStatus && author.competingInterests?.trim()) {
      contribution.competingInterests = {
        status: author.competingInterestsStatus,
        statements: {
          [metadata.locale]: author.competingInterests.trim(),
        },
      };
    }
    snapshot.contributions.push(contribution);
  });

  return snapshot;
}
