import type {
  OmiCrossReference,
  OmiCrossReferenceDisplayStyle,
  OmiCrossReferenceNumbering,
  OmiCrossReferenceTargetKind,
  OmiManuscriptState,
  OmiSection,
} from '../types/omi.ts';

export interface OmiCrossReferenceTarget {
  id: string;
  kind: OmiCrossReferenceTargetKind;
  sectionId: string;
  number: string;
  title: string;
}

export interface OmiCrossReferenceAnchor {
  crossReferenceId: string;
  anchorId: string;
  sourceBlockId: string;
}

export interface OmiCrossReferenceValidationIssue {
  crossReferenceId: string;
  type: 'missing-target' | 'missing-anchor';
  targetId: string;
}

export interface CreateCrossReferenceInput {
  targetId: string;
  targetKind: OmiCrossReferenceTargetKind;
  sourceBlockId: string;
  displayStyle?: OmiCrossReferenceDisplayStyle;
  id?: string;
  anchorId?: string;
}

export const DEFAULT_CROSS_REFERENCE_DISPLAY_STYLE: OmiCrossReferenceDisplayStyle =
  'label-number';
export const DEFAULT_CROSS_REFERENCE_NUMBERING: OmiCrossReferenceNumbering =
  'document';

export function createCrossReference(
  input: CreateCrossReferenceInput,
  timestamp = new Date().toISOString(),
): OmiCrossReference {
  if (!input.targetId.trim()) {
    throw new Error('A cross-reference target identifier is required.');
  }

  if (!input.sourceBlockId.trim()) {
    throw new Error('A cross-reference source block identifier is required.');
  }

  return {
    id: input.id ?? createStableId('xref'),
    anchorId: input.anchorId ?? createStableId('anchor'),
    sourceBlockId: input.sourceBlockId,
    targetId: input.targetId,
    targetKind: input.targetKind,
    displayStyle:
      input.displayStyle ?? DEFAULT_CROSS_REFERENCE_DISPLAY_STYLE,
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

/**
 * Derives the current addressable scholarly targets in manuscript order.
 * Numbers are presentation data and are never written into target objects.
 */
export function collectCrossReferenceTargets(
  manuscript: Pick<
    OmiManuscriptState,
    'sections' | 'crossReferenceNumbering'
  >,
): OmiCrossReferenceTarget[] {
  const numbering =
    manuscript.crossReferenceNumbering ?? DEFAULT_CROSS_REFERENCE_NUMBERING;
  const targets: OmiCrossReferenceTarget[] = [];
  const documentCounters = createCounters();

  manuscript.sections.forEach((section, sectionIndex) => {
    const sectionNumber = String(sectionIndex + 1);
    targets.push({
      id: section.id,
      kind: 'section',
      sectionId: section.id,
      number: sectionNumber,
      title: section.title.trim(),
    });

    const sectionCounters = createCounters();

    for (const block of section.blocks) {
      const kind = targetKindForBlock(block.visual?.kind);
      if (!kind) continue;

      const counters =
        numbering === 'section' ? sectionCounters : documentCounters;
      counters[kind] += 1;
      const ordinal = counters[kind];
      const number =
        numbering === 'section'
          ? `${sectionNumber}.${ordinal}`
          : String(ordinal);

      targets.push({
        id: block.id,
        kind,
        sectionId: section.id,
        number,
        title: targetTitle(block.visual),
      });
    }
  });

  return targets;
}

export function resolveCrossReferenceTarget(
  manuscript: Pick<
    OmiManuscriptState,
    'sections' | 'crossReferenceNumbering'
  >,
  targetId: string,
): OmiCrossReferenceTarget | undefined {
  return collectCrossReferenceTargets(manuscript).find(
    (target) => target.id === targetId,
  );
}

export function formatCrossReferenceLabel(
  crossReference: Pick<
    OmiCrossReference,
    'displayStyle' | 'targetId'
  >,
  target: OmiCrossReferenceTarget | undefined,
  locale = 'en',
): string {
  if (!target) {
    return unresolvedLabel(locale);
  }

  const labels = targetKindLabels(locale);
  const kindLabel = labels[target.kind];
  const number = formatTargetNumber(target);
  const labelNumber = formatLabelNumber(
    kindLabel,
    number,
    target.kind,
    locale,
  );
  const title = target.title.trim();

  switch (crossReference.displayStyle) {
    case 'number':
      return number;
    case 'title':
      return title || labelNumber;
    case 'label-number-title':
      return title ? `${labelNumber} — ${title}` : labelNumber;
    case 'label-number':
    default:
      return labelNumber;
  }
}

export function formatCrossReferenceTargetOption(
  target: OmiCrossReferenceTarget,
  locale = 'en',
): string {
  const base = formatCrossReferenceLabel(
    {
      targetId: target.id,
      displayStyle: 'label-number',
    },
    target,
    locale,
  );

  return target.title ? `${base} — ${target.title}` : base;
}

/**
 * Synchronizes only derived inline labels. The semantic target ID and the
 * target object's own scholarly data are left untouched.
 */
export function synchronizeCrossReferenceLabels(
  sections: readonly OmiSection[],
  crossReferences: readonly OmiCrossReference[],
  numbering: OmiCrossReferenceNumbering = DEFAULT_CROSS_REFERENCE_NUMBERING,
  locale = 'en',
): OmiSection[] {
  const manuscript = {
    sections: sections as OmiSection[],
    crossReferenceNumbering: numbering,
  };
  const targets = collectCrossReferenceTargets(manuscript);
  const targetMap = new Map(targets.map((target) => [target.id, target]));
  const referenceMap = new Map(
    crossReferences.map((reference) => [reference.id, reference]),
  );

  return sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      content: transformStructuredContent(block.content, (node) => {
        if (
          node.type !== 'omiCrossReference' ||
          !isRecord(node.attrs)
        ) {
          return node;
        }

        const crossReferenceId = stringValue(
          node.attrs.crossReferenceId,
        );
        if (!crossReferenceId) return node;

        const reference = referenceMap.get(crossReferenceId);
        if (!reference) return node;

        const target = targetMap.get(reference.targetId);

        return {
          ...node,
          attrs: {
            ...node.attrs,
            crossReferenceId: reference.id,
            anchorId: reference.anchorId,
            label: formatCrossReferenceLabel(
              reference,
              target,
              locale,
            ),
            unresolved: !target,
          },
        };
      }),
    })),
  }));
}

export function collectCrossReferenceAnchors(
  sections: readonly OmiSection[],
): OmiCrossReferenceAnchor[] {
  const anchors: OmiCrossReferenceAnchor[] = [];

  for (const section of sections) {
    for (const block of section.blocks) {
      walkStructuredContent(block.content, (node) => {
        if (
          node.type !== 'omiCrossReference' ||
          !isRecord(node.attrs)
        ) {
          return;
        }

        const crossReferenceId = stringValue(
          node.attrs.crossReferenceId,
        );
        const anchorId = stringValue(node.attrs.anchorId);
        if (!crossReferenceId || !anchorId) return;

        anchors.push({
          crossReferenceId,
          anchorId,
          sourceBlockId: block.id,
        });
      });
    }
  }

  return anchors;
}

export function removeCrossReferenceAnchorFromSections(
  sections: readonly OmiSection[],
  crossReferenceId: string,
): OmiSection[] {
  return sections.map((section) => ({
    ...section,
    blocks: section.blocks.map((block) => ({
      ...block,
      content: transformStructuredContent(block.content, (node) => {
        if (
          node.type === 'omiCrossReference' &&
          isRecord(node.attrs) &&
          stringValue(node.attrs.crossReferenceId) === crossReferenceId
        ) {
          return null;
        }

        return node;
      }),
    })),
  }));
}

export function validateCrossReferences(
  manuscript: Pick<
    OmiManuscriptState,
    | 'sections'
    | 'crossReferences'
    | 'crossReferenceNumbering'
  >,
): OmiCrossReferenceValidationIssue[] {
  const references = manuscript.crossReferences ?? [];
  const targetIds = new Set(
    collectCrossReferenceTargets(manuscript).map((target) => target.id),
  );
  const anchors = new Map(
    collectCrossReferenceAnchors(manuscript.sections).map((anchor) => [
      anchor.crossReferenceId,
      anchor,
    ]),
  );
  const issues: OmiCrossReferenceValidationIssue[] = [];

  for (const reference of references) {
    if (!targetIds.has(reference.targetId)) {
      issues.push({
        crossReferenceId: reference.id,
        type: 'missing-target',
        targetId: reference.targetId,
      });
    }

    if (!anchors.has(reference.id)) {
      issues.push({
        crossReferenceId: reference.id,
        type: 'missing-anchor',
        targetId: reference.targetId,
      });
    }
  }

  return issues;
}

export function targetKindForBlock(
  kind: string | undefined,
): Exclude<OmiCrossReferenceTargetKind, 'section'> | undefined {
  switch (kind) {
    case 'image':
      return 'figure';
    case 'table':
      return 'table';
    case 'chart':
      return 'chart';
    case 'equation':
      return 'equation';
    default:
      return undefined;
  }
}

function targetTitle(
  visual:
    | OmiSection['blocks'][number]['visual']
    | undefined,
): string {
  if (!visual) return '';

  switch (visual.kind) {
    case 'image':
      return visual.caption?.trim() || visual.alt.trim();
    case 'table':
      return visual.caption?.trim() || '';
    case 'chart':
      return visual.title?.trim() || visual.caption?.trim() || '';
    case 'equation':
      return visual.label?.trim() || visual.caption?.trim() || '';
  }
}

function formatTargetNumber(target: OmiCrossReferenceTarget): string {
  return target.kind === 'equation'
    ? `(${target.number})`
    : target.number;
}

function formatLabelNumber(
  label: string,
  number: string,
  kind: OmiCrossReferenceTargetKind,
  locale: string,
): string {
  const language = primaryLanguage(locale);

  if (kind === 'equation') {
    if (language === 'hu') return `${number} ${label}`;
    return `${label} ${number}`;
  }

  if (language === 'hu') {
    return `${number}. ${label}`;
  }

  return `${label} ${number}`;
}

function targetKindLabels(
  locale: string,
): Record<OmiCrossReferenceTargetKind, string> {
  switch (primaryLanguage(locale)) {
    case 'hu':
      return {
        section: 'szakasz',
        figure: 'ábra',
        table: 'táblázat',
        chart: 'grafikon',
        equation: 'egyenlet',
      };
    case 'de':
      return {
        section: 'Abschnitt',
        figure: 'Abbildung',
        table: 'Tabelle',
        chart: 'Diagramm',
        equation: 'Gleichung',
      };
    default:
      return {
        section: 'Section',
        figure: 'Figure',
        table: 'Table',
        chart: 'Chart',
        equation: 'Equation',
      };
  }
}

function unresolvedLabel(locale: string): string {
  switch (primaryLanguage(locale)) {
    case 'hu':
      return '[feloldatlan hivatkozás]';
    case 'de':
      return '[nicht aufgelöster Verweis]';
    default:
      return '[unresolved reference]';
  }
}

function primaryLanguage(locale: string): string {
  return locale.trim().toLowerCase().split('-')[0] ?? 'en';
}

function createCounters(): Record<
  Exclude<OmiCrossReferenceTargetKind, 'section'>,
  number
> {
  return {
    figure: 0,
    table: 0,
    chart: 0,
    equation: 0,
  };
}

function createStableId(prefix: string): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

type JsonNode = {
  type?: string;
  attrs?: unknown;
  content?: unknown;
  [key: string]: unknown;
};

function walkStructuredContent(
  content: string,
  visitor: (node: JsonNode) => void,
): void {
  const root = parseStructuredContent(content);
  if (!root) return;
  walkNode(root, visitor);
}

function walkNode(
  node: JsonNode,
  visitor: (node: JsonNode) => void,
): void {
  visitor(node);
  if (!Array.isArray(node.content)) return;

  for (const child of node.content) {
    if (isRecord(child)) {
      walkNode(child as JsonNode, visitor);
    }
  }
}

function transformStructuredContent(
  content: string,
  transform: (node: JsonNode) => JsonNode | null,
): string {
  const root = parseStructuredContent(content);
  if (!root) return content;

  const transformed = transformNode(root, transform);
  return transformed ? JSON.stringify(transformed) : content;
}

function transformNode(
  node: JsonNode,
  transform: (node: JsonNode) => JsonNode | null,
): JsonNode | null {
  const transformed = transform(node);
  if (!transformed) return null;
  if (!Array.isArray(transformed.content)) return transformed;

  return {
    ...transformed,
    content: transformed.content
      .map((child) =>
        isRecord(child)
          ? transformNode(child as JsonNode, transform)
          : child,
      )
      .filter((child) => child !== null),
  };
}

function parseStructuredContent(
  content: string,
): JsonNode | undefined {
  try {
    const parsed: unknown = JSON.parse(content);
    return isRecord(parsed) ? (parsed as JsonNode) : undefined;
  } catch {
    return undefined;
  }
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : undefined;
}
