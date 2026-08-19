import { createSampleManuscript } from '../../document/sampleManuscript';
import {
  createContribution,
  createPersonAgent,
} from '../../model/identity';
import type { OmiManuscript } from '../../types/omi';

interface LocalizedValue {
  [locale: string]: unknown;
}

interface OmpContributor {
  externalId?: string;
  name?: { given?: string; family?: string };
  email?: string;
  affiliation?: string;
  country?: string | null;
  sequence?: number;
  primaryContact?: boolean;
  isEditor?: boolean;
  identifiers?: Array<{ scheme?: string; value?: string }>;
}

interface OmpFile {
  externalId?: string;
  fileId?: string;
  name?: string | LocalizedValue;
  mediaType?: string;
  fileStage?: number;
  genreId?: number;
  updatedAt?: string | null;
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
  actor?: { externalId?: string } | null;
  actorMode?: 'editor' | 'author' | 'review' | null;
  scope?: string[];
  externalBaseUrl?: string | null;
  apiBaseUrl?: string | null;
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
    return createPersonAgent(
      {
        givenName: contributor.name?.given ?? '',
        familyName: contributor.name?.family ?? '',
        affiliation: contributor.affiliation ?? '',
        orcid: orcid || undefined,
        language: locale,
      },
      crypto.randomUUID(),
      now,
    );
  });
  const contributions = agents.map((agent, index) =>
    createContribution(
      agent.id,
      base.id,
      [contributors[index]?.isEditor ? 'editor' : 'author'],
      contributors[index]?.sequence ?? index + 1,
      crypto.randomUUID(),
      now,
    ),
  );

  const files = launch.files ?? [];
  const sections = files.length
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
    sections,
    createdAt: now,
    updatedAt: launch.submission?.updatedAt || now,
  };
}
