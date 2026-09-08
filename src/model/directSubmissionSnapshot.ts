import { createContribution, createPersonAgent } from './identity';
import type { OmiManuscript } from '../types/omi';
import type { SubmissionAuthor } from '../services/directSubmissionTypes';

/** Export a separate snapshot; preparing a submission never edits the open document. */
export function createDirectSubmissionSnapshot(manuscript: OmiManuscript, metadata: {
  title: string; abstract: string; keywords: string[]; locale: string; authors: SubmissionAuthor[];
}): OmiManuscript {
  const snapshot = structuredClone(manuscript);
  snapshot.title = metadata.title;
  snapshot.abstract = metadata.abstract;
  snapshot.keywords = [...metadata.keywords];
  snapshot.locale = metadata.locale;
  snapshot.abstracts = { ...snapshot.abstracts, [metadata.locale]: metadata.abstract };
  snapshot.keywordsByLocale = { ...snapshot.keywordsByLocale, [metadata.locale]: [...metadata.keywords] };
  snapshot.contributions = snapshot.contributions.map((c) => ({ ...c, roles: c.roles.filter((r) => r !== 'author') })).filter((c) => c.roles.length);
  metadata.authors.forEach((author, index) => {
    const old = snapshot.agents.find((a) => a.id === author.agentId);
    const agent = createPersonAgent({ givenName: author.givenName, familyName: author.familyName, language: metadata.locale }, old?.id ?? crypto.randomUUID());
    if (old) { old.names = agent.names; }
    else snapshot.agents.push(agent);
    const contribution = createContribution(agent.id, snapshot.id, ['author'], index + 1);
    contribution.corresponding = index === 0;
    snapshot.contributions.push(contribution);
  });
  return snapshot;
}
