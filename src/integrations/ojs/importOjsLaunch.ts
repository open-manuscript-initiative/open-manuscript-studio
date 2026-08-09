import { createSampleManuscript } from '../../document/sampleManuscript';
import {
  createContribution,
  createPersonAgent,
} from '../../model/identity';
import type { OmiAnnotation, OmiManuscript } from '../../types/omi';

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

interface OjsSourceInlineText {
  kind: 'text';
  text?: string;
}

interface OjsSourceFootnoteReference {
  kind: 'footnoteReference';
  footnoteId?: string;
}

interface OjsSourceEndnoteReference {
  kind: 'endnoteReference';
  endnoteId?: string;
}

type OjsSourceInline =
  | OjsSourceInlineText
  | OjsSourceFootnoteReference
  | OjsSourceEndnoteReference;

interface OjsSourceParagraph {
  text?: string;
  styleId?: string;
  headingLevel?: number;
  inline?: OjsSourceInline[];
}

interface OjsSourceNote {
  id?: string;
  text?: string;
}

interface OjsSourceDocument {
  kind?: 'docx';
  fileExternalId?: string;
  fileName?: string;
  mediaType?: string;
  paragraphs?: OjsSourceParagraph[];
  footnotes?: OjsSourceNote[];
  endnotes?: OjsSourceNote[];
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

  const imported = buildSourceContent(
    launch.sourceDocument,
    locale,
    title,
    subtitle,
    now,
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
    sections: imported.sections.length
      ? imported.sections
      : [createFallbackImportSection(launch, submission.externalId, locale)],
    annotations: imported.annotations,
    createdAt: now,
    updatedAt: submission.updatedAt || now,
  };
}

function buildSourceContent(
  source: OjsSourceDocument | undefined,
  locale: string,
  manuscriptTitle: string,
  manuscriptSubtitle: string,
  importedAt: string,
): {
  sections: OmiManuscript['sections'];
  annotations: OmiAnnotation[];
} {
  if (source?.kind !== 'docx' || !Array.isArray(source.paragraphs)) {
    return { sections: [], annotations: [] };
  }

  const sections: OmiManuscript['sections'] = [];
  const annotations: OmiAnnotation[] = [];
  const footnotes = createNoteMap(source.footnotes);
  const endnotes = createNoteMap(source.endnotes);
  let noteNumber = 0;
  let current = createSection(defaultBodyTitle(locale));
  const normalizedTitle = normalizeComparison(manuscriptTitle);
  const normalizedSubtitle = normalizeComparison(manuscriptSubtitle);

  const pushCurrent = () => {
    if (current.blocks.length || sections.length === 0) sections.push(current);
  };

  for (const paragraph of source.paragraphs) {
    const text = paragraph.text?.trim() ?? '';
    const hasNoteReference = paragraph.inline?.some(isSourceNoteReference) ?? false;
    if (!text && !hasNoteReference) continue;

    const normalized = normalizeComparison(text);
    if (
      text &&
      (normalized === normalizedTitle ||
        (normalizedSubtitle && normalized === normalizedSubtitle))
    ) {
      continue;
    }

    const headingLevel = inferHeadingLevel(paragraph);
    if (text && headingLevel && !hasNoteReference) {
      if (current.blocks.length) pushCurrent();
      current = createSection(text);
      continue;
    }

    const blockId = crypto.randomUUID();
    const built = buildParagraphContent(
      paragraph,
      blockId,
      footnotes,
      endnotes,
      noteNumber,
      importedAt,
    );
    noteNumber = built.nextNoteNumber;
    annotations.push(...built.annotations);

    current.blocks.push({
      id: blockId,
      type: 'paragraph',
      content: built.content,
    });
  }

  if (current.blocks.length) pushCurrent();
  return {
    sections: sections.filter((section) => section.blocks.length > 0),
    annotations,
  };
}

function inferHeadingLevel(paragraph: OjsSourceParagraph): number | undefined {
  if (
    Number.isInteger(paragraph.headingLevel) &&
    (paragraph.headingLevel ?? 0) >= 1 &&
    (paragraph.headingLevel ?? 0) <= 9
  ) {
    return paragraph.headingLevel;
  }

  const rawStyleId = paragraph.styleId?.trim();
  if (!rawStyleId) return undefined;

  const styleId = rawStyleId
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[\s_.-]+/g, '');

  const patterns = [
    /^heading([1-9])$/,
    /^head([1-9])$/,
    /^title([1-9])$/,
    /^uberschrift([1-9])$/,
    /^cimsor([1-9])$/,
  ];

  for (const pattern of patterns) {
    const match = styleId.match(pattern);
    if (match?.[1]) return Number(match[1]);
  }

  return undefined;
}

function createNoteMap(notes: OjsSourceNote[] | undefined): Map<string, string> {
  return new Map(
    (notes ?? [])
      .filter((note) => note.id !== undefined)
      .map((note) => [String(note.id), typeof note.text === 'string' ? note.text : '']),
  );
}

function isSourceNoteReference(
  item: OjsSourceInline,
): item is OjsSourceFootnoteReference | OjsSourceEndnoteReference {
  return (
    (item.kind === 'footnoteReference' && Boolean(item.footnoteId)) ||
    (item.kind === 'endnoteReference' && Boolean(item.endnoteId))
  );
}

function buildParagraphContent(
  paragraph: OjsSourceParagraph,
  blockId: string,
  footnotes: Map<string, string>,
  endnotes: Map<string, string>,
  startingNoteNumber: number,
  importedAt: string,
): {
  content: string;
  annotations: OmiAnnotation[];
  nextNoteNumber: number;
} {
  const inline = paragraph.inline;
  if (!inline?.some(isSourceNoteReference)) {
    return {
      content: paragraph.text?.trim() ?? '',
      annotations: [],
      nextNoteNumber: startingNoteNumber,
    };
  }

  const nodes: Array<Record<string, unknown>> = [];
  const annotations: OmiAnnotation[] = [];
  let noteNumber = startingNoteNumber;

  const appendText = (value: string) => {
    const lines = value.split('\n');
    lines.forEach((line, index) => {
      if (line) nodes.push({ type: 'text', text: line });
      if (index < lines.length - 1) nodes.push({ type: 'hardBreak' });
    });
  };

  for (const item of inline) {
    if (item.kind === 'text') {
      appendText(item.text ?? '');
      continue;
    }

    const isEndnote = item.kind === 'endnoteReference';
    const sourceNoteId = isEndnote
      ? item.endnoteId?.trim()
      : item.footnoteId?.trim();
    if (!sourceNoteId) continue;

    const noteKind = isEndnote ? 'endnote' : 'footnote';
    const body = (isEndnote ? endnotes : footnotes).get(sourceNoteId) ?? '';

    noteNumber += 1;
    const noteId = `note-${crypto.randomUUID()}`;
    const anchorId = `anchor-${crypto.randomUUID()}`;
    const label = String(noteNumber);

    nodes.push({
      type: 'omiNote',
      attrs: {
        noteId,
        anchorId,
        label,
        noteType: noteKind,
      },
    });

    annotations.push({
      id: noteId,
      type: 'note',
      noteKind,
      anchorId,
      targetBlockId: blockId,
      body,
      renderingHint: noteKind,
      createdAt: importedAt,
      modifiedAt: importedAt,
    });
  }

  return {
    content: JSON.stringify({
      type: 'doc',
      content: [{ type: 'paragraph', content: nodes }],
    }),
    annotations,
    nextNoteNumber: noteNumber,
  };
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
