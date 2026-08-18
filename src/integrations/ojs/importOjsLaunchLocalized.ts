import type { OmiManuscript } from '../../types/omi';
import {
  normalizeLocalizedTerms,
  normalizeLocalizedText,
  normalizeLocale,
  type OmiIntegrationExtensions,
  type OmiScholarlyMetadata,
} from '../../model/scholarlyMetadata';
import { applyOjsInlineSemantics } from './applyOjsInlineSemantics';
import {
  applyOjsReferences,
  prepareOjsReferencesForBaseImport,
} from './applyOjsReferences';
import { applyOjsStructuredContent } from './applyOjsStructuredContent';
import {
  createManuscriptFromOjsLaunch as createBaseManuscriptFromOjsLaunch,
  type OjsLaunchPayload,
} from './importOjsLaunch';

type LocalizedUnknown = Record<string, unknown>;
type LocalizedKeywordValue = LocalizedUnknown | unknown[];

const LIST_SENTINEL = '\u2060';

interface ExtendedOjsSubmission {
  primaryLocale?: string;
  abstract?: LocalizedUnknown;
  keywords?: LocalizedKeywordValue;
  metadata?: Record<string, unknown>;
  extensions?: Record<string, unknown>;
}

interface ExtendedSourceParagraph extends Record<string, unknown> {
  text?: string;
}

interface ExtendedStructuredBlock extends Record<string, unknown> {
  kind?: string;
  text?: string;
  listLevel?: number;
  ordered?: boolean;
}

interface ExtendedSourceDocument extends Record<string, unknown> {
  paragraphs?: ExtendedSourceParagraph[];
  structuredBlocks?: ExtendedStructuredBlock[];
}

export function createManuscriptFromOjsLaunch(
  launch: OjsLaunchPayload,
): OmiManuscript | null {
  // Citation atoms are zero-width semantic objects. Convert them temporarily
  // to their visible labels so the base importer can retain paragraph text;
  // applyOjsReferences restores the semantic OMI citation nodes afterwards.
  const referenceAwareLaunch = prepareOjsReferencesForBaseImport(launch);

  // Word numbered-list paragraphs can superficially resemble headings (for
  // example "1. First item"). Mark known list paragraphs before the base
  // importer runs so heading heuristics cannot consume them as section titles.
  // The sentinel is removed immediately afterwards; structured-content import
  // then converts the preserved paragraph sequence into real Tiptap lists.
  const listAwareLaunch = suppressListHeadingInference(referenceAwareLaunch);
  const baseManuscript = createBaseManuscriptFromOjsLaunch(listAwareLaunch);
  const restoredBase = baseManuscript
    ? removeListSentinels(baseManuscript)
    : null;
  const structurallyImported = restoredBase
    ? applyOjsStructuredContent(
        applyOjsInlineSemantics(restoredBase, launch),
        launch,
      )
    : null;
  const deduplicatedStructured = structurallyImported
    ? removeDuplicateStructuredParagraphs(structurallyImported, launch)
    : null;
  const manuscript = deduplicatedStructured
    ? applyOjsReferences(deduplicatedStructured, launch)
    : null;
  const submission = launch.submission as ExtendedOjsSubmission | null | undefined;

  if (!manuscript || !submission) return manuscript;

  const primaryLocale = normalizeLocale(
    submission.primaryLocale?.trim() || manuscript.locale,
  );
  const abstracts = normalizeLocalizedAbstracts(submission.abstract);
  const keywordsByLocale = normalizeLocalizedKeywords(
    submission.keywords,
    primaryLocale,
  );

  if (manuscript.abstract && !abstracts[primaryLocale]) {
    abstracts[primaryLocale] = manuscript.abstract;
  }
  if (manuscript.keywords.length && !keywordsByLocale[primaryLocale]) {
    keywordsByLocale[primaryLocale] = [...manuscript.keywords];
  }

  const primaryAbstract = abstracts[primaryLocale] ?? manuscript.abstract ?? '';
  const primaryKeywords = keywordsByLocale[primaryLocale] ?? manuscript.keywords;
  const metadata = normalizeScholarlyMetadata(submission.metadata);
  const extensions = normalizeExtensions(submission.extensions);

  return {
    ...manuscript,
    locale: primaryLocale,
    abstract: primaryAbstract,
    keywords: [...primaryKeywords],
    abstracts,
    keywordsByLocale,
    metadata,
    extensions,
  };
}

function suppressListHeadingInference(launch: OjsLaunchPayload): OjsLaunchPayload {
  const source = launch.sourceDocument as unknown as ExtendedSourceDocument | undefined;
  if (!source || !Array.isArray(source.paragraphs) || !Array.isArray(source.structuredBlocks)) {
    return launch;
  }

  const listQueues = new Map<string, number>();
  for (const block of source.structuredBlocks) {
    if (
      block.kind !== 'paragraph' ||
      typeof block.text !== 'string' ||
      !Number.isInteger(block.listLevel) ||
      typeof block.ordered !== 'boolean'
    ) {
      continue;
    }
    const key = normalizeListText(block.text);
    if (!key) continue;
    listQueues.set(key, (listQueues.get(key) ?? 0) + 1);
  }

  if (!listQueues.size) return launch;

  const paragraphs = source.paragraphs.map((paragraph) => {
    const text = typeof paragraph.text === 'string' ? paragraph.text : '';
    const key = normalizeListText(text);
    const remaining = listQueues.get(key) ?? 0;
    if (!key || remaining <= 0) return paragraph;

    if (remaining === 1) listQueues.delete(key);
    else listQueues.set(key, remaining - 1);

    return {
      ...paragraph,
      text: `${LIST_SENTINEL}${text}`,
      // Remove explicit/direct heading signals as well as defeating the
      // text-based numbered-heading fallback with the temporary sentinel.
      styleId: undefined,
      styleName: undefined,
      outlineLevel: undefined,
      headingLevel: undefined,
    };
  });

  return {
    ...launch,
    sourceDocument: {
      ...launch.sourceDocument,
      paragraphs,
    } as OjsLaunchPayload['sourceDocument'],
  };
}

function removeListSentinels(manuscript: OmiManuscript): OmiManuscript {
  const sections = manuscript.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      content: block.content.includes(LIST_SENTINEL)
        ? block.content.split(LIST_SENTINEL).join('')
        : block.content,
    })),
  }));
  return { ...manuscript, sections };
}

function removeDuplicateStructuredParagraphs(
  manuscript: OmiManuscript,
  launch: OjsLaunchPayload,
): OmiManuscript {
  const source = launch.sourceDocument as unknown as ExtendedSourceDocument | undefined;
  if (!Array.isArray(source?.structuredBlocks)) return manuscript;

  const sourceCounts = new Map<string, number>();
  for (const block of source.structuredBlocks) {
    if (block.kind !== 'paragraph' || typeof block.text !== 'string') continue;
    const key = normalizeListText(block.text);
    if (!key) continue;
    sourceCounts.set(key, (sourceCounts.get(key) ?? 0) + 1);
  }
  if (!sourceCounts.size) return manuscript;

  const sections = manuscript.sections.map((section) => {
    const blocks = [] as typeof section.blocks;
    let previousParagraphKey = '';
    let runLength = 0;

    for (const block of section.blocks) {
      if (block.visual || block.type !== 'paragraph') {
        blocks.push(block);
        previousParagraphKey = '';
        runLength = 0;
        continue;
      }

      const key = normalizeListText(storedBlockText(block.content));
      if (key && key === previousParagraphKey) runLength += 1;
      else {
        previousParagraphKey = key;
        runLength = key ? 1 : 0;
      }

      const expected = key ? sourceCounts.get(key) ?? 0 : 0;
      if (expected === 1 && runLength > 1) continue;
      blocks.push(block);
    }

    return { ...section, blocks };
  });

  return { ...manuscript, sections };
}

function storedBlockText(content: string): string {
  const input = content.trim();
  if (!input.startsWith('{')) return content;
  try {
    return collectBlockJsonText(JSON.parse(input) as unknown);
  } catch {
    return content;
  }
}

function collectBlockJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  if (typeof node.text === 'string') return node.text;
  return (node.content ?? []).map(collectBlockJsonText).join('');
}

function normalizeListText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeScholarlyMetadata(
  value: Record<string, unknown> | undefined,
): OmiScholarlyMetadata | undefined {
  if (!value) return undefined;

  const metadata: OmiScholarlyMetadata = {
    subjects: normalizeLocalizedTerms(value.subjects),
    disciplines: normalizeLocalizedTerms(value.disciplines),
    supportingAgencies: normalizeLocalizedTerms(value.supportingAgencies),
    coverage: normalizeLocalizedText(value.coverage),
    rights: normalizeLocalizedText(value.rights),
    source: normalizeLocalizedText(value.source),
    type: normalizeLocalizedText(value.type),
    dataAvailability: normalizeLocalizedText(value.dataAvailability),
    languages: normalizeLocalizedText(value.languages),
    copyrightHolder: normalizeLocalizedText(value.copyrightHolder),
  };

  if (typeof value.publisherId === 'string' && value.publisherId.trim()) {
    metadata.publisherId = value.publisherId.trim();
  }
  if (typeof value.licenseUrl === 'string' && value.licenseUrl.trim()) {
    metadata.licenseUrl = value.licenseUrl.trim();
  }
  if (typeof value.copyrightYear === 'number' && Number.isFinite(value.copyrightYear)) {
    metadata.copyrightYear = value.copyrightYear;
  }

  return metadata;
}

function normalizeExtensions(
  value: Record<string, unknown> | undefined,
): OmiIntegrationExtensions | undefined {
  if (!value) return undefined;
  const ojs = value['org.pkp.ojs'];
  if (!ojs || typeof ojs !== 'object' || Array.isArray(ojs)) {
    return value as OmiIntegrationExtensions;
  }

  const ojsRecord = ojs as Record<string, unknown>;
  const openScienceRaw = ojsRecord.openScience;
  const openScience =
    openScienceRaw && typeof openScienceRaw === 'object' && !Array.isArray(openScienceRaw)
      ? Object.fromEntries(
          Object.entries(openScienceRaw as Record<string, unknown>).map(([key, item]) => [
            key,
            normalizeLocalizedText(item),
          ]),
        )
      : undefined;

  return {
    ...value,
    'org.pkp.ojs': {
      ...ojsRecord,
      ...(openScience ? { openScience } : {}),
    },
  } as OmiIntegrationExtensions;
}

function normalizeLocalizedAbstracts(
  value: LocalizedUnknown | undefined,
): Partial<Record<string, string>> {
  const result: Partial<Record<string, string>> = {};
  if (!value) return result;
  for (const [locale, item] of Object.entries(value)) {
    if (typeof item !== 'string') continue;
    const text = plainText(item).trim();
    if (text) result[normalizeLocale(locale)] = text;
  }
  return result;
}

function normalizeLocalizedKeywords(
  value: LocalizedKeywordValue | undefined,
  primaryLocale: string,
): Partial<Record<string, string[]>> {
  if (!value) return {};
  if (Array.isArray(value)) {
    const keywords = normalizeKeywordList(value);
    return keywords.length ? { [primaryLocale]: keywords } : {};
  }
  const result: Partial<Record<string, string[]>> = {};
  for (const [locale, item] of Object.entries(value)) {
    const keywords = normalizeKeywordList(item);
    if (keywords.length) result[normalizeLocale(locale)] = keywords;
  }
  return result;
}

function normalizeKeywordList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = extractKeywordText(item);
    if (!text) continue;
    const key = text.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function extractKeywordText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '';
  const name = (value as Record<string, unknown>).name;
  return typeof name === 'string' ? name.trim() : '';
}

function plainText(value: string): string {
  if (!value.includes('<')) return value;
  const document = new DOMParser().parseFromString(value, 'text/html');
  return document.body.textContent?.trim() ?? '';
}
