import { createSampleManuscript } from '../../document/sampleManuscript';
import {
  createContribution,
  createPersonAgent,
  type CreditRole,
} from '../../model/identity';
import type { OmiManuscript } from '../../types/omi';
import {
  buildSourceContent,
  type OjsSourceDocument,
} from '../ojs/importOjsLaunch';

interface LocalizedValue {
  [locale: string]: unknown;
}

interface OmpContributor {
  externalId?: string;
  name?: { given?: string; family?: string };
  preferredPublicName?: string | LocalizedValue;
  email?: string;
  affiliation?: string;
  affiliations?: Array<{
    name?: string | LocalizedValue;
    ror?: string | null;
  }>;
  country?: string | null;
  url?: string | null;
  biography?: LocalizedValue;
  competingInterests?: LocalizedValue;
  sequence?: number;
  primaryContact?: boolean;
  includeInBrowse?: boolean;
  isEditor?: boolean;
  creditRoles?: Array<{ role?: string; degree?: string }>;
  identifiers?: Array<{ scheme?: string; value?: string }>;
}

interface OmpFile {
  externalId?: string;
  fileId?: string;
  name?: string | LocalizedValue;
  mediaType?: string;
  stage?: number;
  genreExternalId?: string | null;
  componentExternalId?: string | null;
  updatedAt?: string | null;
}

export interface OmpNativeAuthorContext {
  id: string;
  actorMode: 'author';
  writable: boolean;
  reason?: string | null;
  reviewRoundExternalId?: string | null;
  reviewRound?: number | null;
  stageId?: number | null;
}

export interface OmpLaunchPayload {
  protocol: string;
  profile: string;
  status?: string;
  installation?: {
    installationId?: string;
    displayName?: string;
    baseUrl?: string;
  };
  context?: {
    externalId?: string;
    type?: string;
    path?: string;
    name?: string;
  } | null;
  submission?: {
    externalId?: string;
    type?: string;
    primaryLocale?: string;
    status?: string | number;
    stageId?: string | number;
    title?: string | LocalizedValue;
    subtitle?: string | LocalizedValue;
    abstract?: string | LocalizedValue;
    keywords?: LocalizedValue | unknown[];
    publicationId?: string;
    updatedAt?: string | null;
  } | null;
  component?: {
    externalId?: string;
    type?: string;
    title?: string;
  } | null;
  contributors?: OmpContributor[];
  files?: OmpFile[];
  sourceDocument?: OjsSourceDocument;
  nativeContext?: OmpNativeAuthorContext | null;
  actor?: { externalId?: string } | null;
  actorMode?: 'editor' | 'author' | 'review' | null;
  scope?: string[];
  expiresAt?: string;
}

function localizedString(
  value: string | LocalizedValue | undefined,
  locale: string,
): string {
  if (typeof value === 'string') return value.trim();
  if (!value) return '';
  const preferred = value[locale];
  if (typeof preferred === 'string') return preferred.trim();
  const first = Object.values(value).find((item) => typeof item === 'string');
  return typeof first === 'string' ? first.trim() : '';
}

function keywordList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function localizedKeywords(
  value: LocalizedValue | unknown[] | undefined,
  locale: string,
): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return keywordList(value);
  const preferred = keywordList(value[locale]);
  if (preferred.length) return preferred;
  for (const item of Object.values(value)) {
    const result = keywordList(item);
    if (result.length) return result;
  }
  return [];
}

function fileName(file: OmpFile, locale: string): string {
  return localizedString(file.name, locale) || `OMP file ${file.externalId ?? file.fileId ?? ''}`.trim();
}

function plainText(value: string): string {
  if (!value.includes('<')) return value;
  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.trim() ?? '';
}

const CREDIT_ROLE_IDS: readonly CreditRole[] = [
  'conceptualization',
  'data-curation',
  'formal-analysis',
  'funding-acquisition',
  'investigation',
  'methodology',
  'project-administration',
  'resources',
  'software',
  'supervision',
  'validation',
  'visualization',
  'writing-original-draft',
  'writing-review-editing',
];

function importedCreditRoles(
  values: OmpContributor['creditRoles'],
): CreditRole[] {
  if (!values) return [];
  const allowed = new Set<string>(CREDIT_ROLE_IDS);
  return values
    .map((item) => item.role?.split('/').filter(Boolean).at(-1) ?? '')
    .filter((role): role is CreditRole => allowed.has(role));
}

export async function fetchOmpHandoff(token: string): Promise<OmpLaunchPayload> {
  const response = await fetch(
    `/integrations/omp/handoff/${encodeURIComponent(token)}`,
    {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      credentials: 'same-origin',
    },
  );

  if (!response.ok) {
    const body = await response.json().catch(() => null) as
      | { error?: { message?: string } }
      | null;
    throw new Error(
      body?.error?.message || `OMP handoff failed with HTTP ${response.status}.`,
    );
  }

  const launch = await response.json() as OmpLaunchPayload;
  if (
    launch.protocol !== 'omi-integration/1' ||
    launch.profile !== 'omi-integration/1/omp'
  ) {
    throw new Error('The OMP handoff returned an invalid launch payload.');
  }
  return launch;
}

export function createManuscriptFromOmpLaunch(
  launch: OmpLaunchPayload,
): OmiManuscript | null {
  const externalId = launch.submission?.externalId;
  if (!externalId) return null;

  const base = createSampleManuscript();
  const now = new Date().toISOString();
  const locale = launch.submission?.primaryLocale?.trim() || 'en';
  const title = launch.component?.title?.trim()
    || localizedString(launch.submission?.title, locale)
    || `OMP monograph ${externalId}`;
  const subtitle = localizedString(launch.submission?.subtitle, locale);
  const abstract = localizedString(launch.submission?.abstract, locale);
  const keywords = localizedKeywords(launch.submission?.keywords, locale);

  const contributors = launch.contributors ?? [];
  const agents = contributors.map((contributor) => {
    const orcid = contributor.identifiers?.find(
      (identifier) => identifier.scheme?.toLowerCase() === 'orcid',
    )?.value;
    const primaryAffiliation = contributor.affiliations?.[0];
    const affiliation =
      localizedString(primaryAffiliation?.name, locale) ||
      contributor.affiliation ||
      '';
    const biography = plainText(
      localizedString(contributor.biography, locale),
    );
    return createPersonAgent(
      {
        givenName: contributor.name?.given ?? '',
        familyName: contributor.name?.family ?? '',
        affiliation,
        affiliationRorId: primaryAffiliation?.ror || undefined,
        email: contributor.email,
        country: contributor.country || undefined,
        url: contributor.url || undefined,
        biography: biography ? { [locale]: biography } : undefined,
        orcid: orcid || undefined,
        language: locale,
      },
      crypto.randomUUID(),
      now,
    );
  });
  const contributions = agents.map((agent, index) => {
    const source = contributors[index];
    const contribution = createContribution(
      agent.id,
      base.id,
      [source?.isEditor ? 'editor' : 'author'],
      source?.sequence ?? index + 1,
      crypto.randomUUID(),
      now,
    );
    contribution.corresponding = source?.primaryContact ?? false;
    contribution.attributionName =
      localizedString(source?.preferredPublicName, locale) || undefined;
    contribution.includeInPublicationList = source?.includeInBrowse ?? true;
    contribution.creditRoles = importedCreditRoles(source?.creditRoles);
    const competingInterests = plainText(
      localizedString(source?.competingInterests, locale),
    );
    if (competingInterests) {
      contribution.competingInterests = {
        status: 'unclassified',
        statements: { [locale]: competingInterests },
      };
    }
    return contribution;
  });

  const files = launch.files ?? [];
  const imported = buildSourceContent(
    launch.sourceDocument,
    locale,
    title,
    subtitle,
    now,
  );
  const fallbackSections = files.length
    ? [{
        id: crypto.randomUUID(),
        title: locale.toLowerCase().startsWith('hu')
          ? 'OMP forrásfájlok'
          : locale.toLowerCase().startsWith('de')
            ? 'OMP-Quelldateien'
            : 'OMP source files',
        blocks: [{
          id: crypto.randomUUID(),
          type: 'paragraph' as const,
          content: files.map((file) => fileName(file, locale)).join('\n'),
        }],
      }]
    : [];

  return {
    ...base,
    locale,
    title,
    subtitle: subtitle || undefined,
    abstract,
    keywords,
    agents,
    contributions,
    sections: imported.sections.length ? imported.sections : fallbackSections,
    annotations: imported.annotations,
    createdAt: now,
    updatedAt: launch.submission?.updatedAt || now,
  };
}
