import type { OmiBlock, OmiManuscriptState, OmiSection } from '../types/omi';

export type OmiNamedAnchorTargetKind = 'section' | 'block';

export interface OmiNamedAnchor {
  id: string;
  name: string;
  exportName: string;
  targetId: string;
  targetKind: OmiNamedAnchorTargetKind;
  createdAt?: string;
  modifiedAt?: string;
  source?: {
    format?: string;
    originalName?: string;
  };
}

export interface OmiNamedAnchorTarget {
  id: string;
  kind: OmiNamedAnchorTargetKind;
  sectionId: string;
  label: string;
}

export interface NamedAnchorValidationIssue {
  anchorId: string;
  type: 'duplicate-name' | 'missing-target' | 'invalid-name';
}

export function createNamedAnchor(
  input: {
    name: string;
    targetId: string;
    targetKind: OmiNamedAnchorTargetKind;
    id?: string;
    source?: OmiNamedAnchor['source'];
  },
  timestamp = new Date().toISOString(),
): OmiNamedAnchor {
  const name = normalizeDisplayName(input.name);
  if (!name) throw new Error('A bookmark name is required.');
  if (!input.targetId.trim()) throw new Error('A bookmark target is required.');

  return {
    id: input.id ?? createStableId('bookmark'),
    name,
    exportName: toPortableBookmarkName(name),
    targetId: input.targetId,
    targetKind: input.targetKind,
    createdAt: timestamp,
    modifiedAt: timestamp,
    ...(input.source ? { source: input.source } : {}),
  };
}

export function renameNamedAnchor(
  anchor: OmiNamedAnchor,
  nextName: string,
  timestamp = new Date().toISOString(),
): OmiNamedAnchor {
  const name = normalizeDisplayName(nextName);
  if (!name) throw new Error('A bookmark name is required.');
  return {
    ...anchor,
    name,
    exportName: toPortableBookmarkName(name),
    modifiedAt: timestamp,
  };
}

export function normalizeDisplayName(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

/**
 * Produces a Word-compatible bookmark token while preserving the human-facing
 * OMI name separately. Word bookmark constraints therefore stay an export
 * concern rather than leaking into the semantic document model.
 */
export function toPortableBookmarkName(value: string): string {
  const normalized = normalizeDisplayName(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '');
  const prefixed = /^[A-Za-z]/.test(normalized) ? normalized : `b_${normalized || 'bookmark'}`;
  return prefixed.slice(0, 40);
}

export function collectNamedAnchorTargets(
  sections: readonly OmiSection[],
): OmiNamedAnchorTarget[] {
  const targets: OmiNamedAnchorTarget[] = [];
  for (const section of sections) {
    targets.push({
      id: section.id,
      kind: 'section',
      sectionId: section.id,
      label: section.title.trim() || section.id,
    });
    for (const block of section.blocks) {
      targets.push({
        id: block.id,
        kind: 'block',
        sectionId: section.id,
        label: blockLabel(block),
      });
    }
  }
  return targets;
}

export function resolveNamedAnchorTarget(
  manuscript: Pick<OmiManuscriptState, 'sections'>,
  anchor: OmiNamedAnchor,
): OmiNamedAnchorTarget | undefined {
  return collectNamedAnchorTargets(manuscript.sections).find(
    (target) => target.id === anchor.targetId && target.kind === anchor.targetKind,
  );
}

export function validateNamedAnchors(
  manuscript: Pick<OmiManuscriptState, 'sections'> & { namedAnchors?: OmiNamedAnchor[] },
): NamedAnchorValidationIssue[] {
  const anchors = manuscript.namedAnchors ?? [];
  const targets = new Set(collectNamedAnchorTargets(manuscript.sections).map((target) => `${target.kind}:${target.id}`));
  const counts = new Map<string, number>();
  for (const anchor of anchors) {
    const key = normalizeDisplayName(anchor.name).toLocaleLowerCase();
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const issues: NamedAnchorValidationIssue[] = [];
  for (const anchor of anchors) {
    const key = normalizeDisplayName(anchor.name).toLocaleLowerCase();
    if (!key) issues.push({ anchorId: anchor.id, type: 'invalid-name' });
    if ((counts.get(key) ?? 0) > 1) issues.push({ anchorId: anchor.id, type: 'duplicate-name' });
    if (!targets.has(`${anchor.targetKind}:${anchor.targetId}`)) {
      issues.push({ anchorId: anchor.id, type: 'missing-target' });
    }
  }
  return issues;
}

function blockLabel(block: OmiBlock): string {
  const visual = block.visual;
  if (visual) {
    if (visual.kind === 'image') return visual.caption?.trim() || visual.alt.trim() || 'Image';
    if (visual.kind === 'table') return visual.caption?.trim() || 'Table';
    if (visual.kind === 'chart') return visual.title?.trim() || visual.caption?.trim() || 'Chart';
    if (visual.kind === 'equation') return visual.label?.trim() || visual.caption?.trim() || 'Equation';
  }

  try {
    const parsed = JSON.parse(block.content) as unknown;
    const text = collectText(parsed).replace(/\s+/g, ' ').trim();
    if (text) return text.length > 72 ? `${text.slice(0, 69)}…` : text;
  } catch {
    const text = block.content.replace(/\s+/g, ' ').trim();
    if (text) return text.length > 72 ? `${text.slice(0, 69)}…` : text;
  }
  return `${block.type} · ${block.id}`;
}

function collectText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const record = value as { text?: unknown; content?: unknown };
  const own = typeof record.text === 'string' ? record.text : '';
  const children = Array.isArray(record.content) ? record.content.map(collectText).join(' ') : '';
  return `${own} ${children}`;
}

function createStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** Author-defined stable semantic destinations, analogous to Word bookmarks. */
    namedAnchors?: OmiNamedAnchor[];
  }
}
