import type { OmiIndexEntry } from '../model/indexing';
import type { OmiBlock } from '../types/omi';
import type { DocxManuscriptImportPlan } from './docxManuscriptImport';

/**
 * Normalizes only a Word-generated name-index section before semantic index
 * import. Some DOCX readers flatten the tab between an INDEX entry and its
 * cached page list, producing e.g. "Acsády Ignác376, 391". Insert the missing
 * boundary space first so subsequent index processing sees an unambiguous
 * "name + page cache" shape. Canonical manuscript body text is untouched.
 */
export function normalizeWordGeneratedIndexSpacing(
  plan: DocxManuscriptImportPlan,
): DocxManuscriptImportPlan {
  for (const section of plan.sections) {
    if (!looksLikeIndexHeading(section.title)) continue;
    section.blocks = section.blocks.map(normalizeIndexBlockSpacing);
  }
  return plan;
}

/**
 * Removes Word's cached INDEX rendering from canonical manuscript content.
 *
 * The semantic source of truth is the XE marker collection. Page numbers in an
 * INDEX result are layout cache only and must never be persisted in OMI.
 */
export function removeWordGeneratedIndexCache(
  plan: DocxManuscriptImportPlan,
): DocxManuscriptImportPlan {
  if (!plan.generatedIndexes?.length || !plan.indexEntries?.length) return plan;

  const entryLabels = new Set(
    plan.indexEntries
      .map(indexEntryLabel)
      .filter(Boolean)
      .map(normalizeText),
  );

  plan.sections = plan.sections.filter((section) => {
    const flatBlocks = flattenBlocks(section.blocks);
    const matchingRows = flatBlocks.filter((block) =>
      isGeneratedIndexRow(blockPlainText(block), entryLabels),
    ).length;
    const candidate = looksLikeIndexHeading(section.title)
      || (flatBlocks.length >= 3 && matchingRows / flatBlocks.length >= 0.7);

    if (!candidate) return true;

    section.blocks = section.blocks.filter((block) =>
      !isGeneratedIndexRow(blockPlainText(block), entryLabels),
    );

    return section.blocks.some((block) => blockPlainText(block).trim().length > 0);
  });

  return plan;
}

export function insertIndexLetterNumberSpacing(value: string): string {
  return value.replace(/([\p{L}\p{M}])(?=\d)/gu, '$1 ');
}

export function stripGeneratedIndexPageNumbers(value: string): string {
  return value
    .replace(/\u00a0/g, ' ')
    .replace(/\t[-.·•…_\s]*\d+(?:\s*[-–—,]\s*\d+)*\s*$/u, '')
    // The pre-import spacing normalizer turns flattened Word INDEX rows into
    // e.g. "Acsády Ignác 376, 391". Keep the compact fallback for legacy OMI
    // documents that may already contain the older flattened representation.
    .replace(/\s+\d+(?:\s*,\s*\d+)*\s*$/u, '')
    .replace(/(?<=[\p{L}\p{M}.)])\d+(?:\s*,\s*\d+)*\s*$/u, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeIndexBlockSpacing(block: OmiBlock): OmiBlock {
  return {
    ...block,
    content: normalizeBlockContentSpacing(block.content),
    children: block.children?.map(normalizeIndexBlockSpacing),
  };
}

function normalizeBlockContentSpacing(content: string): string {
  if (!content) return content;
  try {
    const parsed = JSON.parse(content) as unknown;
    const normalized = normalizeJsonTextNodes(parsed);
    return JSON.stringify(normalized);
  } catch {
    if (/<[^>]+>/.test(content)) {
      return content.replace(/(^|>)([^<]+)/g, (_match, prefix: string, text: string) =>
        `${prefix}${insertIndexLetterNumberSpacing(text)}`,
      );
    }
    return insertIndexLetterNumberSpacing(content);
  }
}

function normalizeJsonTextNodes(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalizeJsonTextNodes);
  if (!value || typeof value !== 'object') return value;

  const input = value as Record<string, unknown>;
  const output: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(input)) {
    output[key] = key === 'text' && typeof child === 'string'
      ? insertIndexLetterNumberSpacing(child)
      : normalizeJsonTextNodes(child);
  }
  return output;
}

function isGeneratedIndexRow(value: string, labels: ReadonlySet<string>): boolean {
  const stripped = normalizeText(stripGeneratedIndexPageNumbers(value));
  return Boolean(stripped && labels.has(stripped));
}

function indexEntryLabel(entry: OmiIndexEntry): string {
  return entry.terms.map((term) => term.trim()).filter(Boolean).join(' — ');
}

function looksLikeIndexHeading(value: string): boolean {
  const normalized = normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return [
    'nevmutato',
    'nevjegyzek',
    'name index',
    'index of names',
    'personenregister',
    'namenregister',
  ].some((label) => normalized === label || normalized.endsWith(` ${label}`));
}

function normalizeText(value: string): string {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
}

function blockPlainText(block: OmiBlock): string {
  if (typeof block.content !== 'string') return '';
  try { return collectJsonText(JSON.parse(block.content) as unknown); }
  catch { return block.content.replace(/<[^>]+>/g, ' '); }
}

function collectJsonText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown[] };
  const own = typeof node.text === 'string' ? node.text : '';
  return own + (node.content ?? []).map(collectJsonText).join('');
}

function flattenBlocks(blocks: OmiBlock[]): OmiBlock[] {
  const result: OmiBlock[] = [];
  for (const block of blocks) {
    result.push(block);
    if (block.children?.length) result.push(...flattenBlocks(block.children));
  }
  return result;
}
