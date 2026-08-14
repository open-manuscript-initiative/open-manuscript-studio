import type {
  OmiBibliographicContributor,
  OmiBibliographicRecord,
  OmiCitation,
  OmiCitationCluster,
  OmiManuscript,
} from '../../types/omi';
import type { OjsLaunchPayload } from './importOjsLaunch';

type SourceSemantic =
  | 'strong'
  | 'emphasis'
  | 'strike'
  | 'underline'
  | 'small-caps'
  | 'superscript'
  | 'subscript'
  | 'code';

interface SourceText {
  kind: 'text';
  text?: string;
  semantics?: SourceSemantic[];
  language?: string;
  href?: string;
}

interface SourceNote {
  kind: 'footnoteReference' | 'endnoteReference';
  footnoteId?: string;
  endnoteId?: string;
}

interface SourceCitation {
  kind: 'citationReference';
  sourceTags?: string[];
  label?: string;
}

type SourceInline = SourceText | SourceNote | SourceCitation;

interface SourceParagraph {
  text?: string;
  inline?: SourceInline[];
}

interface SourceBibliographicRecord {
  sourceTag?: string;
  type?: string;
  title?: string;
  subtitle?: string;
  contributors?: Array<{
    role?: string;
    givenName?: string;
    familyName?: string;
    literalName?: string;
  }>;
  containerTitle?: string;
  issued?: string;
  publisher?: string;
  place?: string;
  volume?: string;
  issue?: string;
  pages?: string;
  identifiers?: Array<{ scheme?: string; value?: string }>;
  url?: string;
}

interface ExtendedSourceDocument {
  paragraphs?: SourceParagraph[];
  bibliographicRecords?: SourceBibliographicRecord[];
}

/**
 * Makes server-side citation atoms readable by the base importer. The semantic
 * citation atom is restored after the base/structured import has completed.
 */
export function prepareOjsReferencesForBaseImport(
  launch: OjsLaunchPayload,
): OjsLaunchPayload {
  const source = launch.sourceDocument as unknown as ExtendedSourceDocument | undefined;
  if (!source?.paragraphs?.length) return launch;

  const paragraphs = source.paragraphs.map((paragraph) => {
    if (!paragraph.inline?.some((item) => item.kind === 'citationReference')) {
      return paragraph;
    }
    return {
      ...paragraph,
      inline: paragraph.inline.flatMap((item): SourceInline[] =>
        item.kind === 'citationReference'
          ? [{ kind: 'text', text: item.label ?? '[citation]' }]
          : [item],
      ),
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

/**
 * Projects DOCX hyperlink, DOI and Word CITATION semantics onto the portable
 * OMI citation/reference model after all structural OJS import passes.
 */
export function applyOjsReferences(
  manuscript: OmiManuscript,
  launch: OjsLaunchPayload,
): OmiManuscript {
  const source = launch.sourceDocument as unknown as ExtendedSourceDocument | undefined;
  if (!source) return manuscript;

  const importedAt = new Date().toISOString();
  const sourceRecords = source.bibliographicRecords ?? [];
  const records: OmiBibliographicRecord[] = sourceRecords
    .filter((record) => Boolean(record.sourceTag?.trim() && record.title?.trim()))
    .map((record) => toBibliographicRecord(record, importedAt));
  const recordByTag = new Map(
    sourceRecords.flatMap((sourceRecord, index) => {
      const tag = sourceRecord.sourceTag?.trim();
      const record = records[index];
      return tag && record ? [[tag, record] as const] : [];
    }),
  );

  const citations: OmiCitation[] = [];
  const clusters: OmiCitationCluster[] = [];
  const referenceParagraphs = (source.paragraphs ?? []).filter((paragraph) =>
    paragraph.inline?.some(
      (item) =>
        (item.kind === 'text' && Boolean(item.href)) ||
        item.kind === 'citationReference',
    ),
  );
  const queues = new Map<string, SourceParagraph[]>();
  for (const paragraph of referenceParagraphs) {
    const key = normalize(paragraph.text ?? '');
    if (!key) continue;
    const queue = queues.get(key) ?? [];
    queue.push(paragraph);
    queues.set(key, queue);
  }

  const annotationQueues = new Map(
    manuscript.sections.flatMap((section) =>
      section.blocks.map((block) => [
        block.id,
        manuscript.annotations.filter(
          (annotation) => annotation.type === 'note' && annotation.targetBlockId === block.id,
        ),
      ] as const),
    ),
  );

  const sections = manuscript.sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => {
      const plain = blockPlainText(block.content);
      const queue = queues.get(normalize(plain));
      const paragraph = queue?.shift();
      if (!paragraph?.inline?.length) return block;

      const noteQueue = [...(annotationQueues.get(block.id) ?? [])];
      const nodes: Array<Record<string, unknown>> = [];

      for (const item of paragraph.inline) {
        if (item.kind === 'text') {
          appendTextNodes(nodes, item);
          continue;
        }

        if (item.kind === 'footnoteReference' || item.kind === 'endnoteReference') {
          const annotation = noteQueue.shift();
          if (!annotation?.anchorId) continue;
          nodes.push({
            type: 'omiNote',
            attrs: {
              noteId: annotation.id,
              anchorId: annotation.anchorId,
              label: String(
                manuscript.annotations.filter(
                  (candidate) => candidate.type === 'note',
                ).findIndex((candidate) => candidate.id === annotation.id) + 1,
              ),
              noteType: annotation.noteKind ?? 'footnote',
            },
          });
          continue;
        }

        if (item.kind !== 'citationReference') continue;

        const matchedRecords = (item.sourceTags ?? [])
          .map((tag) => recordByTag.get(tag))
          .filter((record): record is OmiBibliographicRecord => Boolean(record));
        if (!matchedRecords.length) {
          if (item.label) nodes.push({ type: 'text', text: item.label });
          continue;
        }

        const anchorId = `anchor-${crypto.randomUUID()}`;
        const clusterId = `cluster-${crypto.randomUUID()}`;
        const citationIds: string[] = [];
        for (const record of matchedRecords) {
          const citationId = `citation-${crypto.randomUUID()}`;
          citationIds.push(citationId);
          citations.push({
            id: citationId,
            target: record.id,
            anchorId,
            targetBlockId: block.id,
            clusterId,
            mode: 'parenthetical',
            createdAt: importedAt,
            modifiedAt: importedAt,
          });
        }
        clusters.push({
          id: clusterId,
          anchorId,
          targetBlockId: block.id,
          citationIds,
          createdAt: importedAt,
          modifiedAt: importedAt,
        });
        nodes.push({
          type: 'omiCitation',
          attrs: {
            citationId: citationIds[0],
            citationIds,
            clusterId,
            anchorId,
            label: item.label?.trim() || `[${item.sourceTags?.join('; ') ?? 'citation'}]`,
          },
        });
      }

      return {
        ...block,
        content: JSON.stringify({
          type: 'doc',
          content: [{ type: 'paragraph', content: nodes }],
        }),
      };
    }),
  }));

  return {
    ...manuscript,
    sections,
    bibliographicRecords: mergeRecords(manuscript.bibliographicRecords ?? [], records),
    citations: [...manuscript.citations, ...citations],
    citationClusters: [...(manuscript.citationClusters ?? []), ...clusters],
  };
}

function appendTextNodes(
  nodes: Array<Record<string, unknown>>,
  item: SourceText,
): void {
  const text = item.text ?? '';
  if (!text) return;
  const marks: Array<Record<string, unknown>> = [];
  for (const semantic of item.semantics ?? []) {
    switch (semantic) {
      case 'strong': marks.push({ type: 'bold' }); break;
      case 'emphasis': marks.push({ type: 'italic' }); break;
      case 'strike': marks.push({ type: 'strike' }); break;
      case 'underline': marks.push({ type: 'omiUnderline' }); break;
      case 'small-caps': marks.push({ type: 'omiSmallCaps' }); break;
      case 'superscript': marks.push({ type: 'omiSuperscript' }); break;
      case 'subscript': marks.push({ type: 'omiSubscript' }); break;
      case 'code': marks.push({ type: 'code' }); break;
    }
  }
  if (item.language) marks.push({ type: 'omiLanguage', attrs: { lang: item.language } });
  if (item.href) marks.push({ type: 'omiLink', attrs: { href: item.href } });

  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line) nodes.push({ type: 'text', text: line, ...(marks.length ? { marks } : {}) });
    if (index < lines.length - 1) nodes.push({ type: 'hardBreak' });
  });
}

function toBibliographicRecord(
  source: SourceBibliographicRecord,
  timestamp: string,
): OmiBibliographicRecord {
  const contributors: OmiBibliographicContributor[] = (source.contributors ?? [])
    .map((contributor): OmiBibliographicContributor => {
      const givenName = contributor.givenName?.trim();
      const familyName = contributor.familyName?.trim();
      const literalName = contributor.literalName?.trim();
      return {
        id: `bibcontrib-${crypto.randomUUID()}`,
        role: contributor.role || 'author',
        ...(givenName ? { givenName } : {}),
        ...(familyName ? { familyName } : {}),
        ...(literalName ? { literalName } : {}),
      };
    })
    .filter((contributor) => Boolean(contributor.givenName || contributor.familyName || contributor.literalName));

  const subtitle = source.subtitle?.trim();
  const containerTitle = source.containerTitle?.trim();
  const issued = source.issued?.trim();
  const publisher = source.publisher?.trim();
  const place = source.place?.trim();
  const volume = source.volume?.trim();
  const issue = source.issue?.trim();
  const pages = source.pages?.trim();
  const url = source.url?.trim();

  return {
    id: `bib-${crypto.randomUUID()}`,
    type: source.type || 'journal-article',
    title: source.title?.trim() || source.sourceTag?.trim() || 'Unresolved reference',
    contributors,
    identifiers: (source.identifiers ?? [])
      .filter((identifier) => Boolean(identifier.scheme?.trim() && identifier.value?.trim()))
      .map((identifier) => ({
        scheme: identifier.scheme!.trim().toLowerCase(),
        value: identifier.value!.trim(),
      })),
    status: 'provisional',
    createdAt: timestamp,
    modifiedAt: timestamp,
    ...(subtitle ? { subtitle } : {}),
    ...(containerTitle ? { containerTitle } : {}),
    ...(issued ? { issued } : {}),
    ...(publisher ? { publisher } : {}),
    ...(place ? { place } : {}),
    ...(volume ? { volume } : {}),
    ...(issue ? { issue } : {}),
    ...(pages ? { pages } : {}),
    ...(url ? { url } : {}),
  };
}

function mergeRecords(
  existing: readonly OmiBibliographicRecord[],
  imported: readonly OmiBibliographicRecord[],
): OmiBibliographicRecord[] {
  const result = [...existing];
  for (const record of imported) {
    const doi = record.identifiers.find((identifier) => identifier.scheme === 'doi')?.value.toLowerCase();
    const duplicate = result.some((candidate) => {
      const candidateDoi = candidate.identifiers.find((identifier) => identifier.scheme === 'doi')?.value.toLowerCase();
      return doi
        ? candidateDoi === doi
        : normalize(candidate.title) === normalize(record.title) &&
            normalize(candidate.issued ?? '') === normalize(record.issued ?? '');
    });
    if (!duplicate) result.push(record);
  }
  return result;
}

function blockPlainText(content: string): string {
  try {
    const parsed = JSON.parse(content) as unknown;
    return collectText(parsed).trim();
  } catch {
    return content.trim();
  }
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as Record<string, unknown>;
  const own = typeof node.text === 'string' ? node.text : '';
  const attrs = node.attrs && typeof node.attrs === 'object'
    ? node.attrs as Record<string, unknown>
    : undefined;
  const label = node.type === 'omiCitation' && typeof attrs?.label === 'string'
    ? attrs.label
    : '';
  const children = Array.isArray(node.content)
    ? node.content.map(collectText).join('')
    : '';
  return `${own}${label}${children}`;
}

function normalize(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}
