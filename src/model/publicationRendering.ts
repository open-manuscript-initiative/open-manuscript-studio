import type {
  ContributionRole,
  OmiAffiliationAssertion,
} from './identity.ts';
import {
  getPublicationFrontMatterRules,
  type OmiPublicationFrontMatterRules,
} from './frontMatter.ts';
import {
  publicationReadinessSummary,
  resolvePublicationProfile,
  validateManuscriptForPublication,
  type OmiPublicationProfile,
  type OmiPublicationProfileIssue,
} from './publicationProfile.ts';
import { formatHierarchicalSectionNumber } from './sectionNumbering.ts';
import { getParentSectionId } from './sectionStructure.ts';
import type {
  OmiBlock,
  OmiManuscript,
  OmiSection,
} from '../types/omi.ts';

export const OMI_PUBLICATION_RENDERING_MODEL =
  'omi-publication-rendering-context-alpha-0.1' as const;
export const OMI_PUBLICATION_RENDERER_VERSION = '0.1.0-alpha.1' as const;

export interface OmiRenderedAffiliation {
  id: string;
  organizationName: string;
  organizationIdentifier?: string;
  department?: string;
  position?: string;
}

export interface OmiRenderedContributor {
  contributionId: string;
  agentId: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  roles: ContributionRole[];
  corresponding: boolean;
  order: number;
  orcid?: string;
  affiliations: OmiRenderedAffiliation[];
}

export interface OmiRenderedSection {
  id: string;
  parentSectionId?: string;
  title: string;
  number?: string;
  depth: number;
  blocks: OmiBlock[];
  children: OmiRenderedSection[];
}

export interface OmiPublicationRenderingContext {
  model: typeof OMI_PUBLICATION_RENDERING_MODEL;
  rendererVersion: typeof OMI_PUBLICATION_RENDERER_VERSION;
  manuscriptId: string;
  manuscriptVersion: string;
  headRevisionId: string;
  locale: string;
  profile: OmiPublicationProfile;
  frontMatterRules: OmiPublicationFrontMatterRules;
  title: string;
  subtitle?: string;
  motto?: string;
  abstract?: string;
  keywords: string[];
  contributors: OmiRenderedContributor[];
  sections: OmiRenderedSection[];
  publicationIssues: OmiPublicationProfileIssue[];
  readiness: {
    errors: number;
    warnings: number;
    ready: boolean;
  };
}

/**
 * Creates the format-independent publication view consumed by renderers.
 *
 * The function never mutates the manuscript. Profile rules are resolved into
 * derived numbering/presentation context while scholarly identities, blocks,
 * citations and references remain authoritative in the source manuscript.
 */
export function buildPublicationRenderingContext(
  manuscript: OmiManuscript,
  profile: OmiPublicationProfile = resolvePublicationProfile(manuscript),
): OmiPublicationRenderingContext {
  const publicationIssues = validateManuscriptForPublication(manuscript, profile);

  return {
    model: OMI_PUBLICATION_RENDERING_MODEL,
    rendererVersion: OMI_PUBLICATION_RENDERER_VERSION,
    manuscriptId: manuscript.id,
    manuscriptVersion: manuscript.version,
    headRevisionId: manuscript.headRevisionId,
    locale: manuscript.locale,
    profile,
    frontMatterRules: getPublicationFrontMatterRules(profile),
    title: manuscript.title,
    subtitle: optional(manuscript.subtitle),
    motto: optional(manuscript.motto),
    abstract: optional(manuscript.abstract),
    keywords: manuscript.keywords.filter((keyword) => keyword.trim()),
    contributors: collectPublicationContributors(manuscript),
    sections: buildRenderedSectionTree(manuscript.sections, profile),
    publicationIssues,
    readiness: publicationReadinessSummary(publicationIssues),
  };
}

/**
 * Builds the public contributor view used by publication renderers.
 * Restricted/private identity assertions must never leak into an export merely
 * because the containing agent is part of a public author contribution.
 */
export function collectPublicationContributors(
  manuscript: Pick<OmiManuscript, 'id' | 'agents' | 'contributions'>,
): OmiRenderedContributor[] {
  const agentMap = new Map(manuscript.agents.map((agent) => [agent.id, agent]));

  return manuscript.contributions
    .filter(
      (contribution) =>
        contribution.targetId === manuscript.id &&
        contribution.roles.includes('author') &&
        contribution.visibility === 'public',
    )
    .sort(
      (left, right) =>
        (left.order ?? Number.MAX_SAFE_INTEGER) -
        (right.order ?? Number.MAX_SAFE_INTEGER),
    )
    .flatMap((contribution, index) => {
      const agent = agentMap.get(contribution.agentId);
      if (!agent || agent.type !== 'person') return [];

      const publicNames = agent.names.filter(
        (name) => name.visibility === 'public',
      );
      const preferred =
        publicNames.find((name) => name.preferred) ?? publicNames[0];
      const displayName =
        contribution.attributionName?.trim() || preferred?.value?.trim();
      if (!displayName) return [];

      const affiliations = agent.affiliations
        .filter((affiliation) => affiliation.visibility === 'public')
        .map(toRenderedAffiliation);
      const publicOrcid = agent.identifiers.find(
        (identifier) =>
          identifier.visibility === 'public' &&
          identifier.scheme.trim().toLowerCase() === 'orcid' &&
          Boolean(
            (identifier.normalizedValue || identifier.value).trim(),
          ),
      );
      const orcidValue =
        publicOrcid?.normalizedValue.trim() || publicOrcid?.value.trim();

      return [
        {
          contributionId: contribution.id,
          agentId: agent.id,
          displayName,
          givenName: optional(preferred?.givenName),
          familyName: optional(preferred?.familyName),
          roles: [...contribution.roles],
          corresponding: contribution.corresponding === true,
          order: contribution.order ?? index + 1,
          orcid: orcidValue
            ? `https://orcid.org/${orcidValue.replace(
                /^https?:\/\/orcid\.org\//i,
                '',
              )}`
            : undefined,
          affiliations,
        },
      ];
    });
}

export function buildRenderedSectionTree(
  sections: readonly OmiSection[],
  profile: OmiPublicationProfile,
): OmiRenderedSection[] {
  const nodeMap = new Map<string, OmiRenderedSection>();

  for (const section of sections) {
    const parentSectionId = getParentSectionId(section);
    const depth = sectionDepth(sections, section.id);
    const number =
      depth < profile.rules.sections.maxNumberedDepth
        ? formatHierarchicalSectionNumber(
            sections,
            section.id,
            profile.rules.sections.numberingStyle,
          )
        : '';

    nodeMap.set(section.id, {
      id: section.id,
      parentSectionId,
      title: section.title,
      number: number || undefined,
      depth,
      blocks: section.blocks,
      children: [],
    });
  }

  const roots: OmiRenderedSection[] = [];

  for (const section of sections) {
    const node = nodeMap.get(section.id);
    if (!node) continue;

    const parent = node.parentSectionId
      ? nodeMap.get(node.parentSectionId)
      : undefined;

    if (parent && parent.id !== node.id) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function sectionDepth(
  sections: readonly OmiSection[],
  sectionId: string,
): number {
  const map = new Map(sections.map((section) => [section.id, section]));
  const visited = new Set<string>();
  let current = map.get(sectionId);
  let depth = 0;

  while (current) {
    const parentId = getParentSectionId(current);
    if (!parentId || visited.has(parentId)) break;
    visited.add(parentId);
    const parent = map.get(parentId);
    if (!parent) break;
    depth += 1;
    current = parent;
  }

  return depth;
}

function toRenderedAffiliation(
  affiliation: OmiAffiliationAssertion,
): OmiRenderedAffiliation {
  const publicOrganizationIdentifier =
    affiliation.organizationIdentifier?.visibility === 'public'
      ? affiliation.organizationIdentifier
      : undefined;

  return {
    id: affiliation.id,
    organizationName: affiliation.organizationName,
    organizationIdentifier:
      publicOrganizationIdentifier?.normalizedValue ||
      publicOrganizationIdentifier?.value ||
      undefined,
    department: optional(affiliation.department),
    position: optional(affiliation.position),
  };
}

function optional(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}
