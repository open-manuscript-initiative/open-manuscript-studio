import type { OjsLaunchData } from './ojsClient.js';
import type { OjsStructuredBlock } from './docxStructureTypes.js';
import type {
  ReviewBibliographicRecord,
  ReviewInlineSemantic,
  ReviewInlineSpan,
  ReviewManuscriptBlock,
  ReviewManuscriptSnapshot,
} from '../../services/reviewManuscriptService.js';

interface SourceParagraph {
  text: string;
  headingLevel?: number;
  outlineLevel?: number;
  inline?: unknown[];
}

interface StructuredSourceDocument {
  paragraphs?: SourceParagraph[];
  structuredBlocks?: OjsStructuredBlock[];
  footnotes?: Array<{ text: string }>;
  endnotes?: Array<{ text: string }>;
  bibliographicRecords?: ReviewBibliographicRecord[];
}

type ReviewDocumentLocale = 'en' | 'hu' | 'de';

interface BibliographyLocaleCopy {
  heading: string;
  volume: string;
  issue: string;
  pages: string;
}

const bibliographyLocaleCopy: Record<ReviewDocumentLocale, BibliographyLocaleCopy> = {
  en: {
    heading: 'References',
    volume: 'vol.',
    issue: 'no.',
    pages: 'pp.',
  },
  hu: {
    heading: 'Hivatkozások',
    volume: 'évf.',
    issue: 'sz.',
    pages: 'o.',
  },
  de: {
    heading: 'Literatur',
    volume: 'Bd.',
    issue: 'Nr.',
    pages: 'S.',
  },
};

export function createReviewSnapshotFromOjs(
  data: OjsLaunchData,
): ReviewManuscriptSnapshot {
  const submission = asRecord(data.submission);
  const title = pickLocalizedString(submission.title) ?? 'Untitled manuscript';
  const subtitle = pickLocalizedString(submission.subtitle);
  const abstract = pickLocalizedString(submission.abstract);
  const keywords = collectKeywords(submission.keywords);
  const blocks: ReviewManuscriptBlock[] = [];
  const source = data.sourceDocument as StructuredSourceDocument | undefined;
  const documentLocale = pickDocumentLocale(submission);
  const bibliographyCopy = bibliographyLocaleCopy[documentLocale];

  const paragraphQueues = buildParagraphQueues(source?.paragraphs ?? []);
  const structured = source?.structuredBlocks ?? [];

  if (structured.length) {
    const orderedCounters = new Map<number, number>();
    for (const item of structured) {
      if (item.kind === 'paragraph') {
        const paragraph = takeParagraph(paragraphQueues, item.text);
        const richText = paragraph ? paragraphRichText(paragraph) : [];
        const level = item.headingLevel ?? paragraph?.headingLevel ??
          (typeof paragraph?.outlineLevel === 'number' ? paragraph.outlineLevel + 1 : undefined);

        if (level !== undefined) {
          blocks.push({
            type: 'heading',
            text: item.text,
            level: Math.max(1, Math.min(6, level)),
            ...(richText.length ? { richText } : {}),
          });
          resetListCounters(orderedCounters);
          continue;
        }

        if (Number.isInteger(item.listLevel) && typeof item.ordered === 'boolean') {
          const listLevel = Math.max(0, item.listLevel ?? 0);
          let ordinal: number | undefined;
          if (item.ordered) {
            ordinal = (orderedCounters.get(listLevel) ?? 0) + 1;
            orderedCounters.set(listLevel, ordinal);
          } else {
            orderedCounters.delete(listLevel);
          }
          for (const key of Array.from(orderedCounters.keys())) {
            if (key > listLevel) orderedCounters.delete(key);
          }
          blocks.push({
            type: 'list',
            text: item.text,
            ordered: item.ordered,
            listLevel,
            ...(ordinal !== undefined ? { ordinal } : {}),
            ...(richText.length ? { richText } : {}),
          });
          continue;
        }

        resetListCounters(orderedCounters);
        blocks.push({
          type: 'paragraph',
          text: item.text,
          ...(richText.length ? { richText } : {}),
        });
        continue;
      }

      resetListCounters(orderedCounters);
      if (item.kind === 'table') {
        blocks.push({
          type: 'table',
          cells: item.cells,
          headerRows: item.headerRows,
        });
        continue;
      }
      if (item.kind === 'image') {
        blocks.push({
          type: 'image',
          src: item.src,
          mediaType: item.mediaType,
          fileName: item.fileName,
          ...(item.alt ? { alt: item.alt } : {}),
        });
        continue;
      }
      if (item.kind === 'chart') {
        blocks.push({
          type: 'chart',
          cells: item.cells,
          chartType: item.chartType,
          ...(item.title ? { title: item.title } : {}),
        });
      }
    }
  } else {
    for (const paragraph of source?.paragraphs ?? []) {
      const text = paragraph.text.trim();
      if (!text) continue;
      const richText = paragraphRichText(paragraph);
      const level = paragraph.headingLevel ??
        (typeof paragraph.outlineLevel === 'number' ? paragraph.outlineLevel + 1 : undefined);
      blocks.push(level !== undefined
        ? {
            type: 'heading',
            text,
            level: Math.max(1, Math.min(6, level)),
            ...(richText.length ? { richText } : {}),
          }
        : {
            type: 'paragraph',
            text,
            ...(richText.length ? { richText } : {}),
          });
    }
  }

  for (const note of source?.footnotes ?? []) {
    const text = note.text.trim();
    if (text) blocks.push({ type: 'note', text });
  }
  for (const note of source?.endnotes ?? []) {
    const text = note.text.trim();
    if (text) blocks.push({ type: 'note', text });
  }

  const bibliographicRecords = source?.bibliographicRecords ?? [];
  if (bibliographicRecords.length) {
    blocks.push({ type: 'heading', text: bibliographyCopy.heading, level: 2 });
    for (const record of bibliographicRecords) {
      const text = formatBibliographicRecord(record, bibliographyCopy);
      if (text) blocks.push({ type: 'paragraph', text });
    }
  }

  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(abstract ? { abstract } : {}),
    keywords,
    blocks,
    bibliographicRecords,
  };
}

function buildParagraphQueues(paragraphs: SourceParagraph[]): Map<string, SourceParagraph[]> {
  const queues = new Map<string, SourceParagraph[]>();
  for (const paragraph of paragraphs) {
    const key = normalize(paragraph.text);
    if (!key) continue;
    const queue = queues.get(key) ?? [];
    queue.push(paragraph);
    queues.set(key, queue);
  }
  return queues;
}

function takeParagraph(
  queues: Map<string, SourceParagraph[]>,
  text: string,
): SourceParagraph | undefined {
  const queue = queues.get(normalize(text));
  return queue?.shift();
}

function paragraphRichText(paragraph: SourceParagraph): ReviewInlineSpan[] {
  if (!Array.isArray(paragraph.inline)) return [];
  const spans: ReviewInlineSpan[] = [];
  for (const raw of paragraph.inline) {
    const inline = asRecord(raw);

    if (inline.kind === 'citationReference') {
      const sourceTags = Array.isArray(inline.sourceTags)
        ? inline.sourceTags
            .filter((value): value is string => typeof value === 'string' && Boolean(value.trim()))
            .map((value) => value.trim())
            .slice(0, 100)
        : [];
      const label = typeof inline.label === 'string' && inline.label.trim()
        ? inline.label.trim()
        : sourceTags.length
          ? `[${sourceTags.join('; ')}]`
          : '[citation]';
      if (!sourceTags.length) continue;
      spans.push({
        text: label,
        citation: { sourceTags, label },
      });
      continue;
    }

    if (inline.kind !== 'text' || typeof inline.text !== 'string' || !inline.text) continue;
    const semantics = Array.isArray(inline.semantics)
      ? inline.semantics.filter(isInlineSemantic)
      : [];
    const language = typeof inline.language === 'string' && inline.language.trim()
      ? inline.language.trim()
      : undefined;
    spans.push({
      text: inline.text,
      ...(semantics.length ? { semantics } : {}),
      ...(language ? { language } : {}),
    });
  }
  return spans;
}

function formatBibliographicRecord(
  record: ReviewBibliographicRecord,
  copy: BibliographyLocaleCopy,
): string {
  const contributors = record.contributors
    .map((contributor) => contributor.literalName ||
      [contributor.familyName, contributor.givenName].filter(Boolean).join(', '))
    .filter(Boolean)
    .join('; ');
  const title = record.subtitle ? `${record.title}: ${record.subtitle}` : record.title;
  const container = [
    record.containerTitle,
    record.volume ? `${copy.volume} ${record.volume}` : undefined,
    record.issue ? `${copy.issue} ${record.issue}` : undefined,
    record.pages ? `${copy.pages} ${record.pages}` : undefined,
  ].filter(Boolean).join(', ');
  const publication = [
    record.place,
    record.publisher,
    record.issued,
  ].filter(Boolean).join(': ');
  const doi = record.identifiers.find((identifier) => identifier.scheme.toLowerCase() === 'doi')?.value;
  const identifier = doi ? `https://doi.org/${doi.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, '')}` : record.url;

  return [
    contributors ? `${contributors}.` : undefined,
    `${title}.`,
    container ? `${container}.` : undefined,
    publication ? `${publication}.` : undefined,
    identifier,
  ].filter(Boolean).join(' ');
}

function pickDocumentLocale(submission: Record<string, unknown>): ReviewDocumentLocale {
  const candidates = [
    submission.locale,
    submission.language,
    submission.primaryLocale,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const normalized = candidate.trim().toLowerCase().replace('_', '-');
    if (normalized === 'hu' || normalized.startsWith('hu-')) return 'hu';
    if (normalized === 'de' || normalized.startsWith('de-')) return 'de';
    if (normalized === 'en' || normalized.startsWith('en-')) return 'en';
  }

  return 'en';
}

function isInlineSemantic(value: unknown): value is ReviewInlineSemantic {
  return value === 'strong' || value === 'emphasis' || value === 'strike' ||
    value === 'underline' || value === 'small-caps' || value === 'superscript' ||
    value === 'subscript' || value === 'code';
}

function resetListCounters(counters: Map<number, number>): void {
  counters.clear();
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function collectKeywords(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap(keywordValue).filter(Boolean).slice(0, 100);
  }
  if (!value || typeof value !== 'object') return [];
  return Object.values(value as Record<string, unknown>)
    .flatMap(keywordValue)
    .filter(Boolean)
    .slice(0, 100);
}

function keywordValue(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value.trim()] : [];
  if (Array.isArray(value)) return value.flatMap(keywordValue);
  if (!value || typeof value !== 'object') return [];
  const record = value as Record<string, unknown>;
  return keywordValue(record.name ?? record.value ?? record.label);
}

function pickLocalizedString(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim() || undefined;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  for (const item of Object.values(value as Record<string, unknown>)) {
    if (typeof item === 'string' && item.trim()) return item.trim();
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
