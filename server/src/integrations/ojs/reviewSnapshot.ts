import type { OjsLaunchData } from './ojsClient.js';
import type { ReviewManuscriptSnapshot } from '../../services/reviewManuscriptService.js';

export function createReviewSnapshotFromOjs(
  data: OjsLaunchData,
): ReviewManuscriptSnapshot {
  const submission = asRecord(data.submission);
  const title = pickLocalizedString(submission.title) ?? 'Untitled manuscript';
  const subtitle = pickLocalizedString(submission.subtitle);
  const abstract = pickLocalizedString(submission.abstract);
  const keywords = collectKeywords(submission.keywords);
  const blocks: ReviewManuscriptSnapshot['blocks'] = [];

  for (const paragraph of data.sourceDocument?.paragraphs ?? []) {
    const text = paragraph.text.trim();
    if (!text) continue;
    const level = paragraph.headingLevel ??
      (typeof paragraph.outlineLevel === 'number' ? paragraph.outlineLevel + 1 : undefined);
    blocks.push(level !== undefined
      ? { type: 'heading', text, level: Math.max(1, Math.min(6, level)) }
      : { type: 'paragraph', text });
  }

  for (const note of data.sourceDocument?.footnotes ?? []) {
    const text = note.text.trim();
    if (text) blocks.push({ type: 'note', text });
  }
  for (const note of data.sourceDocument?.endnotes ?? []) {
    const text = note.text.trim();
    if (text) blocks.push({ type: 'note', text });
  }

  return {
    title,
    ...(subtitle ? { subtitle } : {}),
    ...(abstract ? { abstract } : {}),
    keywords,
    blocks,
  };
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
