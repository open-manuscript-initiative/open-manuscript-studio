import { createSampleManuscript } from '../../document/sampleManuscript';
import {
  createContribution,
  createPersonAgent,
} from '../../model/identity';
import type { OmiManuscript } from '../../types/omi';

interface OjsLocalizedValue {
  [locale: string]: unknown;
}

interface OjsContributor {
  externalId?: string;
  name?: {
    given?: string;
    family?: string;
  };
  email?: string;
  affiliation?: string;
  country?: string | null;
  sequence?: number;
  primaryContact?: boolean;
  identifiers?: Array<{
    scheme?: string;
    value?: string;
  }>;
}

interface OjsSubmission {
  externalId?: string;
  primaryLocale?: string;
  title?: OjsLocalizedValue;
  subtitle?: OjsLocalizedValue;
  abstract?: OjsLocalizedValue;
  keywords?: OjsLocalizedValue;
  status?: string;
  updatedAt?: string | null;
}

export interface OjsLaunchPayload {
  protocol: string;
  profile: string;
  installation?: {
    installationId?: string;
    displayName?: string;
    baseUrl?: string;
  };
  context?: {
    externalId?: string;
    path?: string;
  } | null;
  submission?: OjsSubmission | null;
  contributors?: OjsContributor[];
  files?: Array<Record<string, unknown>>;
  actor?: {
    externalId?: string;
  } | null;
  scope?: string[];
  expiresAt?: string;
}

const STORAGE_KEY = 'omi:ojs-launch';

function localizedString(
  value: OjsLocalizedValue | undefined,
  locale: string,
): string {
  if (!value) {
    return '';
  }

  const preferred = value[locale];
  if (typeof preferred === 'string') {
    return preferred;
  }

  const first = Object.values(value).find(
    (item) => typeof item === 'string',
  );

  return typeof first === 'string' ? first : '';
}

function localizedStrings(
  value: OjsLocalizedValue | undefined,
  locale: string,
): string[] {
  if (!value) {
    return [];
  }

  const preferred = value[locale];
  if (Array.isArray(preferred)) {
    return preferred.filter(
      (item): item is string =>
        typeof item === 'string',
    );
  }

  for (const item of Object.values(value)) {
    if (Array.isArray(item)) {
      return item.filter(
        (entry): entry is string =>
          typeof entry === 'string',
      );
    }
  }

  return [];
}

function plainText(value: string): string {
  if (!value.includes('<')) {
    return value;
  }

  const document = new DOMParser().parseFromString(
    value,
    'text/html',
  );

  return document.body.textContent?.trim() ?? '';
}

export function consumeOjsLaunchPayload(): OjsLaunchPayload | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  sessionStorage.removeItem(STORAGE_KEY);

  try {
    const parsed = JSON.parse(raw) as unknown;

    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { protocol?: unknown }).protocol !==
        'omi-integration/1' ||
      (parsed as { profile?: unknown }).profile !==
        'omi-integration/1/ojs'
    ) {
      return null;
    }

    return parsed as OjsLaunchPayload;
  } catch {
    return null;
  }
}

export function createManuscriptFromOjsLaunch(
  launch: OjsLaunchPayload,
): OmiManuscript | null {
  const submission = launch.submission;
  if (!submission?.externalId) {
    return null;
  }

  const locale =
    submission.primaryLocale?.trim() || 'en';
  const now = new Date().toISOString();
  const base = createSampleManuscript();
  const title =
    localizedString(submission.title, locale) ||
    `OJS submission ${submission.externalId}`;
  const abstract = plainText(
    localizedString(submission.abstract, locale),
  );
  const keywords = localizedStrings(
    submission.keywords,
    locale,
  );

  const agents = (launch.contributors ?? []).map(
    (contributor) => {
      const orcid = contributor.identifiers?.find(
        (identifier) =>
          identifier.scheme?.toLowerCase() === 'orcid',
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
    },
  );

  const contributions = agents.map((agent, index) =>
    createContribution(
      agent.id,
      base.id,
      ['author'],
      index + 1,
      crypto.randomUUID(),
      now,
    ),
  );

  const fileNames = (launch.files ?? [])
    .map((file) =>
      typeof file.name === 'string'
        ? file.name
        : null,
    )
    .filter((value): value is string => Boolean(value));

  const sourceDescription = [
    `Imported from OJS submission ${submission.externalId}.`,
    launch.installation?.displayName
      ? `Source: ${launch.installation.displayName}.`
      : '',
    fileNames.length
      ? `Available OJS files: ${fileNames.join(', ')}.`
      : 'No OJS submission files were listed.',
    'Binary manuscript transfer is not enabled yet; the source file content has not been imported.',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    ...base,
    locale,
    title,
    subtitle:
      localizedString(
        submission.subtitle,
        locale,
      ) || undefined,
    abstract,
    keywords,
    agents,
    contributions,
    sections: [
      {
        id: crypto.randomUUID(),
        title: 'OJS import',
        blocks: [
          {
            id: crypto.randomUUID(),
            type: 'paragraph',
            content: sourceDescription,
          },
        ],
      },
    ],
    createdAt: now,
    updatedAt: submission.updatedAt || now,
  };
}
