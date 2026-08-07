import {
  OMI_IDENTITY_MODEL_VERSION,
  createContribution,
  createPersonAgent,
  type OmiAgent,
  type OmiContribution,
} from '../model/identity';
import type { OmiTombstone } from '../model/tombstone';
import type {
  OmiIdentifier,
  OmiManuscript,
  OmiManuscriptState,
  OmiPerson,
} from '../types/omi';

type OptionalVersioningFields = Partial<
  Pick<
    OmiManuscript,
    | 'versioningModelVersion'
    | 'headRevisionId'
    | 'revisionHistory'
  >
>;

export type IdentityMigratedManuscript =
  OmiManuscriptState & OptionalVersioningFields;

export type LegacyOmiManuscript = Omit<
  OmiManuscriptState,
  | 'identityModelVersion'
  | 'agents'
  | 'contributions'
  | 'tombstones'
> & {
  identityModelVersion?: OmiManuscriptState['identityModelVersion'];
  agents?: OmiAgent[];
  contributions?: OmiContribution[];
  tombstones?: OmiTombstone[];
  authors?: OmiPerson[];
} & OptionalVersioningFields;

/**
 * Upgrades the legacy embedded `authors` representation to the
 * OMI-SPEC-150 agent and contribution model.
 *
 * The migration is idempotent: documents that already contain agents and
 * contributions are returned with only the identity model marker normalized.
 * Existing OMI-SPEC-160 history fields and tombstones are preserved for the
 * next migration stage and are never embedded into an agent or contribution.
 */
export function migrateIdentityModel(
  manuscript: LegacyOmiManuscript,
): IdentityMigratedManuscript {
  const existingAgents = manuscript.agents ?? [];
  const existingContributions = manuscript.contributions ?? [];
  const tombstones = manuscript.tombstones ?? [];

  if (
    existingAgents.length > 0 ||
    existingContributions.length > 0 ||
    !manuscript.authors?.length
  ) {
    return {
      ...manuscript,
      identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
      agents: existingAgents,
      contributions: normalizeContributionOrder(existingContributions),
      tombstones,
    };
  }

  const timestamp = manuscript.updatedAt || new Date().toISOString();
  const agents = manuscript.authors.map((author) =>
    createAgentFromLegacyAuthor(author, timestamp),
  );
  const contributions = agents.map((agent, index) =>
    createContribution(
      agent.id,
      manuscript.id,
      ['author'],
      index + 1,
      crypto.randomUUID(),
      timestamp,
    ),
  );

  return {
    ...manuscript,
    identityModelVersion: OMI_IDENTITY_MODEL_VERSION,
    agents,
    contributions,
    tombstones,
  };
}

function createAgentFromLegacyAuthor(
  author: OmiPerson,
  timestamp: string,
): OmiAgent {
  const orcid = findIdentifier(author.identifiers, 'orcid');

  return createPersonAgent(
    {
      givenName: author.givenName,
      familyName: author.familyName,
      affiliation: author.affiliation,
      orcid,
    },
    author.id,
    timestamp,
  );
}

function findIdentifier(
  identifiers: OmiIdentifier[] | undefined,
  type: string,
): string | undefined {
  const normalizedType = type.trim().toLowerCase();

  return identifiers?.find(
    (identifier) =>
      identifier.type.trim().toLowerCase() === normalizedType,
  )?.value;
}

function normalizeContributionOrder(
  contributions: OmiContribution[],
): OmiContribution[] {
  return [...contributions]
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) -
        (right.order ?? Number.MAX_SAFE_INTEGER),
    )
    .map((contribution, index) => ({
      ...contribution,
      order: index + 1,
    }));
}
