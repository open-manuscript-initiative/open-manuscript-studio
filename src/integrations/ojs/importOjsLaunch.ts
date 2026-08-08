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
  name?: { given?: string; family?: string };
  email?: string;
  affiliation?: string;
  country?: string | null;
  sequence?: number;
  primaryContact?: boolean;
  identifiers?: Array<{ scheme?: string; value?: string }>;
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

interface OjsSourceParagraph {
  text?: string;
  styleId?: string;
  headingLevel?: number;
}

interface OjsSourceDocument {
  kind?: 'docx';
  fileExternalId?: string;
  fileName?: string;
  mediaType?: string;
  paragraphs?: OjsSourceParagraph[];
}

export interface OjsLaunchPayload {
  protocol: string;
  profile: string;
  installation?: {
    installationId?: string;
    displayName?: string;
    baseUrl?: string;
  };
  context?: { externalId?: string; path?: string } | null;
  submission?: OjsSubmission | null;
  contributors?: OjsContributor[];
  files?: Array<Record<string, unknown>>;
  sourceDocument?: OjsSourceDocument;
  actor?: { externalId?: string } | null;
  scope?: string[];
  expiresAt?: string;
}

const STORAGE_KEY = 'omi:ojs-launch';

function localizedString(
  value: OjsLocalizedValue | undefined,
  locale: string,
): string {
  if (!value) return '';
  const preferred = value[locale];
  if (typeof preferred === 'string') return preferred;
  const first = Object.values(value).find((item) => typeof item === 'string');
  return typeof first === 'string' ? first : '';
}

function localizedStrings(
  value: OjsLocalizedValue | undefined,
  locale: string,
): string[] {
  if (!value) return [];
  const preferred = value[locale];
  if (Array.isArray(preferred)) {
    return preferred.filter((item): item is string => typeof item === 'string');
  }
  for (const item of Object.values(value)) {
    if (Array.isArray(item)) {
      return item.filter((entry): entry is string => typeof entry === 'string');
    }
  }
  return [];
}

function plainText(value: string): string {
  if (!value.includes('<')) return value;
  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.trim() ?? '';
}

export function readOjsLaunchPayload(): OjsLaunchPayload | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      (parsed as { protocol?: unknown }).protocol !== 'omi-integration/1' ||
      (parsed as { profile?: unknown }).profile !== 'omi-integration/1/ojs'
    ) {
      return null;
    }
    return parsed as OjsLaunchPayload;
  } catch {
    return null;
  }
}

export function clearOjsLaunchPayload(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function consumeOjsLaunchPayload(): OjsLaunchPayload | null {
  const launch = readOjsLaunchPayload();
  if (launch) clearOjsLaunchPayload();
  return launch;
}

export function createManuscriptFromOjsLaunch(
  launch: OjsLaunchPayload,
): OmiManuscript | null {
  const submission = launch.submission;
  if (!submission?.externalId) return null;

  const locale = submission.primaryLocale?.trim() || 'en';
  const now = new Date().toISOString();
  const base = createSampleManuscript();
  const title =
    localizedString(submission.title, locale) ||
    `OJS submission ${submission.externalId}`;
  const subtitle = localizedString(submission.subtitle, locale);
  const abstract = plainText(localizedString(submission.abstract, locale));
  const keywords = localizedStrings(submission.keywords, locale);

  const agents = (launch.contributors ?? []).map((contributor) => {
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
      ['author'],
      index + 1,
      crypto.randomUUID(),
      now,
    ),
  );

  const sections = buildSourceSections(
    launch.sourceDocument,
    locale,
    title,
    subtitle,
  );

  return {
    ...base,
    locale,
    title,
    subtitle: subtitle || undefined,
    abstract,
    keywords,
    agents,
    contributions,
    sections: sections.length
      ? sections
      : [createFallbackImportSection(launch, submission.externalId, locale)],
    createdAt: now,
    updatedAt: submission.updatedAt || now,
  };
}

function buildSourceSections(
  source: OjsSourceDocument | undefined,
  locale: string,
  manuscriptTitle: string,
  manuscriptSubtitle: string,
): OmiManuscript['sections'] {
  if (source?.kind !== 'docx' || !Array.isArray(source.paragraphs)) return [];

  const sections: OmiManuscript['sections'] = [];
  let current = createSection(defaultBodyTitle(locale));
  const normalizedTitle = normalizeComparison(manuscriptTitle);
  const normalizedSubtitle = normalizeComparison(manuscriptSubtitle);

  const pushCurrent = () => {
    if (current.blocks.length || sections.length === 0) sections.push(current);
  };

  for (const paragraph of source.paragraphs) {
    const text = paragraph.text?.trim();
    if (!text) continue;

    const normalized = normalizeComparison(text);
    if (normalized === normalizedTitle || (normalizedSubtitle && normalized === normalizedSubtitle)) {
      continue;
    }

    if (paragraph.headingLevel && paragraph.headingLevel >= 1) {
      if (current.blocks.length) pushCurrent();
      current = createSection(text);
      continue;
    }

    current.blocks.push({
      id: crypto.randomUUID(),
      type: 'paragraph',
      content: text,
    });
  }

  if (current.blocks.length) pushCurrent();
  return sections.filter((section) => section.blocks.length > 0);
}

function createSection(title: string): OmiManuscript['sections'][number] {
  return {
    id: crypto.randomUUID(),
    title,
    blocks: [],
  };
}

function createFallbackImportSection(
  launch: OjsLaunchPayload,
  submissionId: string,
  locale: string,
): OmiManuscript['sections'][number] {
  const fileNames = (launch.files ?? [])
    .map((file) => typeof file.name === 'string' ? file.name : null)
    .filter((value): value is string => Boolean(value));
  const labels = fallbackLabels(locale);
  const parts = [
    `${labels.imported} ${submissionId}.`,
    launch.installation?.displayName
      ? `${labels.source}: ${launch.installation.displayName}.`
      : '',
    fileNames.length
      ? `${labels.files}: ${fileNames.join(', ')}.`
      : labels.noFiles,
    labels.noContent,
  ].filter(Boolean);

  return {
    id: crypto.randomUUID(),
    title: labels.section,
    blocks: [{
      id: crypto.randomUUID(),
      type: 'paragraph',
      content: parts.join(' '),
    }],
  };
}

function defaultBodyTitle(locale: string): string {
  if (locale.toLowerCase().startsWith('hu')) return 'Kézirat';
  if (locale.toLowerCase().startsWith('de')) return 'Manuskript';
  return 'Manuscript';
}

function fallbackLabels(locale: string) {
  if (locale.toLowerCase().startsWith('hu')) {
    return {
      section: 'OJS-import',
      imported: 'Importálva az OJS-ből, beküldésazonosító:',
      source: 'Forrás',
      files: 'Elérhető OJS-fájlok',
      noFiles: 'Az OJS nem adott át fájllistát.',
      noContent: 'A forrásfájl tartalma nem volt átadható vagy feldolgozható.',
    };
  }
  if (locale.toLowerCase().startsWith('de')) {
    return {
      section: 'OJS-Import',
      imported: 'Aus OJS importiert, Einreichungs-ID:',
      source: 'Quelle',
      files: 'Verfügbare OJS-Dateien',
      noFiles: 'OJS hat keine Dateiliste übermittelt.',
      noContent: 'Der Inhalt der Quelldatei konnte nicht übertragen oder verarbeitet werden.',
    };
  }
  return {
    section: 'OJS import',
    imported: 'Imported from OJS submission',
    source: 'Source',
    files: 'Available OJS files',
    noFiles: 'OJS did not provide a file list.',
    noContent: 'The source file content could not be transferred or processed.',
  };
}

function normalizeComparison(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}
