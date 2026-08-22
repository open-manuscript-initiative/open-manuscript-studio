import type {
  OmiBlock,
  OmiManuscript,
  OmiSection,
} from '../types/omi';
import type {
  ExternalDocumentScope,
  TranslationSegment,
} from '../services/integrationExecutionApi';

const SKIPPED_TIPTAP_NODE_TYPES = new Set([
  'codeBlock',
  'omiCitation',
  'omiCrossReference',
  'omiNote',
]);

interface JsonNode {
  type?: string;
  text?: string;
  marks?: Array<{ type?: string }>;
  content?: JsonNode[];
  [key: string]: unknown;
}

export interface StructuredTranslationPlan {
  scope: ExternalDocumentScope;
  segments: TranslationSegment[];
}

export function buildStructuredTranslationPlan(
  manuscript: OmiManuscript,
  scope: ExternalDocumentScope,
): StructuredTranslationPlan {
  const segments: TranslationSegment[] = [];

  if (scope.kind === 'block') {
    const block = findBlock(manuscript, scope.id);
    if (block) collectBlockSegments(block, segments);
    return { scope, segments };
  }

  if (scope.kind === 'section') {
    const section = manuscript.sections.find((candidate) => candidate.id === scope.id);
    if (section) collectSectionSegments(section, segments);
    return { scope, segments };
  }

  if (scope.kind !== 'manuscript') return { scope, segments };

  addStringSegment(segments, 'front:title', manuscript.title, 'title');
  addStringSegment(segments, 'front:subtitle', manuscript.subtitle, 'subtitle');
  addStringSegment(segments, 'front:abstract', manuscript.abstract, 'abstract');
  manuscript.keywords.forEach((keyword, index) =>
    addStringSegment(segments, `front:keyword:${index}`, keyword, 'keyword'),
  );
  manuscript.sections.forEach((section) => collectSectionSegments(section, segments));
  manuscript.annotations.forEach((annotation) =>
    addStringSegment(segments, `annotation:${annotation.id}:body`, annotation.body, 'note'),
  );

  return { scope, segments };
}

export function applyStructuredTranslations(
  manuscript: OmiManuscript,
  scope: ExternalDocumentScope,
  translations: TranslationSegment[],
): OmiManuscript {
  const translatedById = new Map(translations.map((segment) => [segment.id, segment.text]));
  const next = structuredClone(manuscript);

  if (scope.kind === 'block') {
    for (const section of next.sections) {
      const index = section.blocks.findIndex((block) => block.id === scope.id);
      if (index >= 0) {
        const block = section.blocks[index];
        if (block) section.blocks[index] = applyBlockTranslations(block, translatedById);
        break;
      }
    }
    return next;
  }

  if (scope.kind === 'section') {
    next.sections = next.sections.map((section) =>
      section.id === scope.id ? applySectionTranslations(section, translatedById) : section,
    );
    return next;
  }

  if (scope.kind !== 'manuscript') return next;

  next.title = translatedById.get('front:title') ?? next.title;
  if (next.subtitle !== undefined) {
    next.subtitle = translatedById.get('front:subtitle') ?? next.subtitle;
  }
  if (next.abstract !== undefined) {
    next.abstract = translatedById.get('front:abstract') ?? next.abstract;
  }
  next.keywords = next.keywords.map(
    (keyword, index) => translatedById.get(`front:keyword:${index}`) ?? keyword,
  );
  next.sections = next.sections.map((section) => applySectionTranslations(section, translatedById));
  next.annotations = next.annotations.map((annotation) => ({
    ...annotation,
    body: translatedById.get(`annotation:${annotation.id}:body`) ?? annotation.body,
  }));
  return next;
}

function collectSectionSegments(section: OmiSection, output: TranslationSegment[]): void {
  addStringSegment(output, `section:${section.id}:title`, section.title, 'section-title');
  section.blocks.forEach((block) => collectBlockSegments(block, output));
}

function collectBlockSegments(block: OmiBlock, output: TranslationSegment[]): void {
  if (block.visual) {
    if (block.visual.kind === 'image') {
      addStringSegment(output, `visual:${block.id}:alt`, block.visual.alt, 'image-alt');
      addStringSegment(output, `visual:${block.id}:caption`, block.visual.caption, 'caption');
    } else if (block.visual.kind === 'table') {
      addStringSegment(output, `visual:${block.id}:caption`, block.visual.caption, 'caption');
    } else if (block.visual.kind === 'chart') {
      addStringSegment(output, `visual:${block.id}:title`, block.visual.title, 'chart-title');
      addStringSegment(output, `visual:${block.id}:caption`, block.visual.caption, 'caption');
    } else if (block.visual.kind === 'equation') {
      addStringSegment(output, `visual:${block.id}:caption`, block.visual.caption, 'caption');
    }
    return;
  }

  const parsed = parseTiptapDocument(block.content);
  if (!parsed) {
    addStringSegment(output, `legacy:${block.id}`, block.content, block.type);
    return;
  }

  walkTiptapText(parsed, [], (path, text) => {
    addStringSegment(output, `block:${block.id}:${path.join('.')}`, text, block.type);
  });
}

function applySectionTranslations(
  section: OmiSection,
  translatedById: Map<string, string>,
): OmiSection {
  return {
    ...section,
    title: translatedById.get(`section:${section.id}:title`) ?? section.title,
    blocks: section.blocks.map((block) => applyBlockTranslations(block, translatedById)),
  };
}

function applyBlockTranslations(
  block: OmiBlock,
  translatedById: Map<string, string>,
): OmiBlock {
  if (block.visual) {
    const visual = { ...block.visual };
    if (visual.kind === 'image') {
      visual.alt = translatedById.get(`visual:${block.id}:alt`) ?? visual.alt;
      if (visual.caption !== undefined) {
        visual.caption = translatedById.get(`visual:${block.id}:caption`) ?? visual.caption;
      }
    } else if (visual.kind === 'table') {
      if (visual.caption !== undefined) {
        visual.caption = translatedById.get(`visual:${block.id}:caption`) ?? visual.caption;
      }
    } else if (visual.kind === 'chart') {
      if (visual.title !== undefined) {
        visual.title = translatedById.get(`visual:${block.id}:title`) ?? visual.title;
      }
      if (visual.caption !== undefined) {
        visual.caption = translatedById.get(`visual:${block.id}:caption`) ?? visual.caption;
      }
    } else if (visual.kind === 'equation' && visual.caption !== undefined) {
      visual.caption = translatedById.get(`visual:${block.id}:caption`) ?? visual.caption;
    }
    return { ...block, visual };
  }

  const legacy = translatedById.get(`legacy:${block.id}`);
  const parsed = parseTiptapDocument(block.content);
  if (!parsed) return legacy === undefined ? block : { ...block, content: legacy };

  const next = structuredClone(parsed);
  walkTiptapText(next, [], (path, currentText) => {
    const translated = translatedById.get(`block:${block.id}:${path.join('.')}`);
    if (translated !== undefined) setTextAtPath(next, path, translated, currentText);
  });
  return { ...block, content: JSON.stringify(next) };
}

function walkTiptapText(
  node: JsonNode,
  path: number[],
  visitor: (path: number[], text: string) => void,
): void {
  if (node.type && SKIPPED_TIPTAP_NODE_TYPES.has(node.type)) return;
  if (node.marks?.some((mark) => mark.type === 'code')) return;
  if (node.type === 'text' && typeof node.text === 'string') {
    if (node.text.trim()) visitor(path, node.text);
    return;
  }
  node.content?.forEach((child, index) => walkTiptapText(child, [...path, index], visitor));
}

function setTextAtPath(root: JsonNode, path: number[], text: string, fallback: string): void {
  let current = root;
  for (const index of path) {
    const next = current.content?.[index];
    if (!next) return;
    current = next;
  }
  if (current.type === 'text' && current.text === fallback) current.text = text;
}

function parseTiptapDocument(content: string): JsonNode | null {
  if (!content.trim()) return null;
  try {
    const parsed = JSON.parse(content) as unknown;
    if (parsed && typeof parsed === 'object' && (parsed as JsonNode).type === 'doc') {
      return parsed as JsonNode;
    }
  } catch {
    // Legacy plain text is handled by a single segment.
  }
  return null;
}

function addStringSegment(
  output: TranslationSegment[],
  id: string,
  value: string | undefined,
  kind: string,
): void {
  if (!value?.trim()) return;
  output.push({ id, text: value, kind });
}

function findBlock(manuscript: OmiManuscript, blockId: string | undefined): OmiBlock | undefined {
  if (!blockId) return undefined;
  return manuscript.sections.flatMap((section) => section.blocks).find((block) => block.id === blockId);
}
