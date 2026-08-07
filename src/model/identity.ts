export const OMI_IDENTITY_MODEL_VERSION =
  'OMI-SPEC-150@0.1.0' as const;

export const ROR_API_SOURCE =
  'https://api.ror.org/v2/organizations' as const;

export type AgentId = string;
export type NameFormId = string;
export type IdentityAssertionId = string;
export type AffiliationAssertionId = string;
export type ContributionId = string;

export type AgentType =
  | 'person'
  | 'organization'
  | 'consortium'
  | 'project'
  | 'service'
  | 'unidentified';

export type IdentityVisibility =
  | 'public'
  | 'restricted'
  | 'private'
  | 'withheld';

export type IdentityVerificationStatus =
  | 'unverified'
  | 'self-asserted'
  | 'verified'
  | 'rejected';

export type ContributionRole =
  | 'author'
  | 'editor'
  | 'translator'
  | 'reviewer'
  | 'data-curator'
  | 'software'
  | 'methodology'
  | 'visualization'
  | 'other';

export interface OmiNameForm {
  id: NameFormId;
  value: string;
  givenName?: string;
  familyName?: string;
  language?: string;
  script?: string;
  preferred?: boolean;
  visibility: IdentityVisibility;
  validFrom?: string;
  validUntil?: string;
}

export interface OmiExternalIdentifierAssertion {
  id: IdentityAssertionId;
  scheme: string;
  value: string;
  normalizedValue: string;
  verificationStatus: IdentityVerificationStatus;
  source?: string;
  assertedAt?: string;
  visibility: IdentityVisibility;
}

export interface OmiAffiliationAssertion {
  id: AffiliationAssertionId;
  organizationName: string;
  organizationIdentifier?: OmiExternalIdentifierAssertion;
  department?: string;
  position?: string;
  validFrom?: string;
  validUntil?: string;
  source?: string;
  visibility: IdentityVisibility;
}

export interface OmiAgent {
  id: AgentId;
  type: AgentType;
  names: OmiNameForm[];
  identifiers: OmiExternalIdentifierAssertion[];
  affiliations: OmiAffiliationAssertion[];
  createdAt: string;
  updatedAt: string;
}

export interface OmiContribution {
  id: ContributionId;
  agentId: AgentId;
  targetId: string;
  roles: ContributionRole[];
  order?: number;
  corresponding?: boolean;
  attributionName?: string;
  visibility: IdentityVisibility;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePersonAgentInput {
  givenName: string;
  familyName: string;
  displayName?: string;
  language?: string;
  affiliation?: string;
  orcid?: string;
}

export interface ContributorEditInput {
  givenName?: string;
  familyName?: string;
  affiliation?: string;

  /**
   * Preferred full ROR URL for the selected affiliation organization.
   * `null` explicitly removes a previously linked ROR identifier.
   */
  affiliationRorId?: string | null;

  orcid?: string;
}

export function createPersonAgent(
  input: CreatePersonAgentInput,
  id: AgentId = crypto.randomUUID(),
  timestamp: string = new Date().toISOString(),
): OmiAgent {
  const givenName = input.givenName.trim();
  const familyName = input.familyName.trim();
  const displayName =
    input.displayName?.trim() ||
    [givenName, familyName].filter(Boolean).join(' ');

  if (!displayName) {
    throw new Error('A contributor name is required.');
  }

  const identifiers: OmiExternalIdentifierAssertion[] = [];
  const normalizedOrcid = input.orcid
    ? normalizeOrcid(input.orcid)
    : undefined;

  if (normalizedOrcid) {
    identifiers.push(
      createExternalIdentifierAssertion(
        'orcid',
        normalizedOrcid,
        'self-asserted',
        timestamp,
      ),
    );
  }

  const affiliations: OmiAffiliationAssertion[] = [];
  const affiliation = input.affiliation?.trim();

  if (affiliation) {
    affiliations.push({
      id: crypto.randomUUID(),
      organizationName: affiliation,
      visibility: 'public',
    });
  }

  return {
    id,
    type: 'person',
    names: [
      {
        id: crypto.randomUUID(),
        value: displayName,
        givenName: givenName || undefined,
        familyName: familyName || undefined,
        language: input.language?.trim().toLowerCase() || undefined,
        preferred: true,
        visibility: 'public',
      },
    ],
    identifiers,
    affiliations,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function createContribution(
  agentId: AgentId,
  targetId: string,
  roles: ContributionRole[] = ['author'],
  order?: number,
  id: ContributionId = crypto.randomUUID(),
  timestamp: string = new Date().toISOString(),
): OmiContribution {
  const normalizedTargetId = targetId.trim();

  if (!agentId.trim()) {
    throw new Error('The contributor agent identifier is required.');
  }

  if (!normalizedTargetId) {
    throw new Error('The contribution target identifier is required.');
  }

  return {
    id,
    agentId,
    targetId: normalizedTargetId,
    roles: normalizeContributionRoles(roles),
    order,
    corresponding: false,
    visibility: 'public',
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function updatePersonAgent(
  agent: OmiAgent,
  input: ContributorEditInput,
  timestamp: string = new Date().toISOString(),
): OmiAgent {
  const currentName = getPreferredNameForm(agent);
  const givenName =
    input.givenName !== undefined
      ? input.givenName.trim()
      : currentName?.givenName ?? '';
  const familyName =
    input.familyName !== undefined
      ? input.familyName.trim()
      : currentName?.familyName ?? '';
  const displayName =
    [givenName, familyName].filter(Boolean).join(' ') ||
    currentName?.value ||
    'Unnamed contributor';

  const nextName: OmiNameForm = {
    id: currentName?.id ?? crypto.randomUUID(),
    value: displayName,
    givenName: givenName || undefined,
    familyName: familyName || undefined,
    language: currentName?.language,
    script: currentName?.script,
    preferred: true,
    visibility: currentName?.visibility ?? 'public',
    validFrom: currentName?.validFrom,
    validUntil: currentName?.validUntil,
  };

  const otherNames = agent.names.filter(
    (name) => name.id !== currentName?.id,
  );

  let identifiers = agent.identifiers;

  if (input.orcid !== undefined) {
    const normalizedOrcid = normalizeOrcid(input.orcid);
    const otherIdentifiers = agent.identifiers.filter(
      (identifier) => identifier.scheme.toLowerCase() !== 'orcid',
    );

    identifiers = normalizedOrcid
      ? [
          ...otherIdentifiers,
          createExternalIdentifierAssertion(
            'orcid',
            normalizedOrcid,
            'self-asserted',
            timestamp,
          ),
        ]
      : otherIdentifiers;
  }

  let affiliations = agent.affiliations;

  if (input.affiliation !== undefined) {
    const organizationName = input.affiliation.trim();
    const currentAffiliation = agent.affiliations[0];
    const rorInputWasProvided = input.affiliationRorId !== undefined;
    const normalizedRorId =
      typeof input.affiliationRorId === 'string'
        ? normalizeRorId(input.affiliationRorId)
        : '';
    const organizationIdentifier = normalizedRorId
      ? createExternalIdentifierAssertion(
          'ror',
          normalizedRorId,
          'verified',
          timestamp,
          ROR_API_SOURCE,
        )
      : !rorInputWasProvided &&
          currentAffiliation?.organizationName === organizationName
        ? currentAffiliation.organizationIdentifier
        : undefined;
    const source = normalizedRorId
      ? ROR_API_SOURCE
      : organizationIdentifier
        ? currentAffiliation?.source
        : undefined;

    affiliations = organizationName
      ? [
          {
            id: currentAffiliation?.id ?? crypto.randomUUID(),
            organizationName,
            organizationIdentifier,
            department: currentAffiliation?.department,
            position: currentAffiliation?.position,
            validFrom: currentAffiliation?.validFrom,
            validUntil: currentAffiliation?.validUntil,
            source,
            visibility: currentAffiliation?.visibility ?? 'public',
          },
          ...agent.affiliations.slice(1),
        ]
      : agent.affiliations.slice(1);
  }

  return {
    ...agent,
    names: [nextName, ...otherNames],
    identifiers,
    affiliations,
    updatedAt: timestamp,
  };
}

export function getPreferredNameForm(
  agent: OmiAgent,
): OmiNameForm | undefined {
  return agent.names.find((name) => name.preferred) ?? agent.names[0];
}

export function getAgentDisplayName(agent: OmiAgent): string {
  return getPreferredNameForm(agent)?.value || 'Unnamed contributor';
}

export function getPrimaryAffiliation(agent: OmiAgent): string {
  return agent.affiliations[0]?.organizationName ?? '';
}

export function getPrimaryAffiliationRorId(agent: OmiAgent): string {
  const identifier = agent.affiliations[0]?.organizationIdentifier;

  if (!identifier || identifier.scheme.trim().toLowerCase() !== 'ror') {
    return '';
  }

  return normalizeRorId(identifier.normalizedValue || identifier.value);
}

export function getExternalIdentifierValue(
  agent: OmiAgent,
  scheme: string,
): string {
  const normalizedScheme = scheme.trim().toLowerCase();

  return (
    agent.identifiers.find(
      (identifier) =>
        identifier.scheme.trim().toLowerCase() === normalizedScheme,
    )?.normalizedValue ?? ''
  );
}

export function normalizeContributionRoles(
  roles: ContributionRole[],
): ContributionRole[] {
  const normalized = Array.from(new Set(roles));

  return normalized.length > 0 ? normalized : ['author'];
}

export function normalizeOrcid(orcid: string): string {
  return orcid
    .trim()
    .replace(/^https?:\/\/orcid\.org\//i, '')
    .toUpperCase();
}

export function isValidOrcid(orcid: string): boolean {
  const normalizedOrcid = normalizeOrcid(orcid);

  if (!normalizedOrcid) {
    return true;
  }

  if (!/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(normalizedOrcid)) {
    return false;
  }

  const characters = normalizedOrcid.replace(/-/g, '');
  const body = characters.slice(0, 15);
  const suppliedCheckDigit = characters[15];

  let total = 0;

  for (const character of body) {
    total = (total + Number(character)) * 2;
  }

  const remainder = total % 11;
  const result = (12 - remainder) % 11;
  const calculatedCheckDigit = result === 10 ? 'X' : String(result);

  return calculatedCheckDigit === suppliedCheckDigit;
}

export function normalizeRorId(rorId: string): string {
  const uniqueId = rorId
    .trim()
    .replace(/^https?:\/\/(?:www\.)?ror\.org\//i, '')
    .replace(/^ror\.org\//i, '')
    .replace(/\/$/, '')
    .toLowerCase();

  return /^0[a-hj-km-np-tv-z0-9]{6}[0-9]{2}$/.test(uniqueId)
    ? `https://ror.org/${uniqueId}`
    : '';
}

export function isValidRorId(rorId: string): boolean {
  return normalizeRorId(rorId).length > 0;
}

function createExternalIdentifierAssertion(
  scheme: string,
  value: string,
  verificationStatus: IdentityVerificationStatus,
  assertedAt: string,
  source?: string,
): OmiExternalIdentifierAssertion {
  const normalizedScheme = scheme.trim().toLowerCase();
  const normalizedValue =
    normalizedScheme === 'orcid'
      ? normalizeOrcid(value)
      : normalizedScheme === 'ror'
        ? normalizeRorId(value)
        : value.trim();

  return {
    id: crypto.randomUUID(),
    scheme: normalizedScheme,
    value: normalizedValue,
    normalizedValue,
    verificationStatus,
    source,
    assertedAt,
    visibility: 'public',
  };
}
