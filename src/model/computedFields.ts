import type { OmiCrossReferenceDisplayStyle, OmiManuscriptState } from '../types/omi';
import { formatCrossReferenceLabel, resolveCrossReferenceTarget } from './crossReferences';
import type { OmiSemanticField } from './semanticFields';

export type OmiComputedFieldKind =
  | 'document-property'
  | 'semantic-field'
  | 'cross-reference'
  | 'current-date'
  | 'section-count'
  | 'word-count';

export type OmiComputedDocumentProperty =
  | 'title'
  | 'subtitle'
  | 'locale'
  | 'created-at'
  | 'updated-at';

export interface OmiComputedField {
  id: string;
  label: string;
  kind: OmiComputedFieldKind;
  property?: OmiComputedDocumentProperty;
  semanticFieldId?: string;
  crossReferenceTargetId?: string;
  crossReferenceDisplayStyle?: OmiCrossReferenceDisplayStyle;
  dateStyle?: 'short' | 'medium' | 'long' | 'iso';
  fallback?: string;
  source?: {
    format?: string;
    instruction?: string;
  };
  createdAt?: string;
  modifiedAt?: string;
}

export interface OmiComputedFieldValidationIssue {
  fieldId: string;
  type:
    | 'missing-label'
    | 'missing-property'
    | 'missing-semantic-field'
    | 'missing-cross-reference-target';
}

export interface CreateComputedFieldInput {
  label: string;
  kind: OmiComputedFieldKind;
  property?: OmiComputedDocumentProperty;
  semanticFieldId?: string;
  crossReferenceTargetId?: string;
  crossReferenceDisplayStyle?: OmiCrossReferenceDisplayStyle;
  dateStyle?: OmiComputedField['dateStyle'];
  fallback?: string;
  id?: string;
  source?: OmiComputedField['source'];
}

export const COMPUTED_FIELD_PRESETS: ReadonlyArray<Pick<CreateComputedFieldInput, 'label' | 'kind' | 'property' | 'dateStyle'>> = [
  { label: 'Document title', kind: 'document-property', property: 'title' },
  { label: 'Document subtitle', kind: 'document-property', property: 'subtitle' },
  { label: 'Document language', kind: 'document-property', property: 'locale' },
  { label: 'Created', kind: 'document-property', property: 'created-at', dateStyle: 'medium' },
  { label: 'Last modified', kind: 'document-property', property: 'updated-at', dateStyle: 'medium' },
  { label: 'Current date', kind: 'current-date', dateStyle: 'medium' },
  { label: 'Section count', kind: 'section-count' },
  { label: 'Word count', kind: 'word-count' },
];

export function createComputedField(
  input: CreateComputedFieldInput,
  timestamp = new Date().toISOString(),
): OmiComputedField {
  const label = input.label.trim().replace(/\s+/g, ' ');
  if (!label) throw new Error('A computed field label is required.');
  validateDefinition(input);
  return {
    id: input.id ?? createStableId('computed'),
    label,
    kind: input.kind,
    ...(input.property ? { property: input.property } : {}),
    ...(input.semanticFieldId ? { semanticFieldId: input.semanticFieldId } : {}),
    ...(input.crossReferenceTargetId ? { crossReferenceTargetId: input.crossReferenceTargetId } : {}),
    ...(input.crossReferenceDisplayStyle ? { crossReferenceDisplayStyle: input.crossReferenceDisplayStyle } : {}),
    ...(input.dateStyle ? { dateStyle: input.dateStyle } : {}),
    ...(input.fallback ? { fallback: input.fallback } : {}),
    ...(input.source ? { source: input.source } : {}),
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function resolveComputedField(
  manuscript: OmiManuscriptState & { semanticFields?: OmiSemanticField[]; computedFields?: OmiComputedField[] },
  field: OmiComputedField,
  locale = manuscript.locale || 'en',
  now = new Date(),
): string {
  let value = '';
  switch (field.kind) {
    case 'document-property':
      value = resolveDocumentProperty(manuscript, field.property, locale, field.dateStyle);
      break;
    case 'semantic-field': {
      const source = manuscript.semanticFields?.find((item) => item.id === field.semanticFieldId);
      if (source) value = typeof source.value === 'boolean' ? (source.value ? 'true' : 'false') : String(source.value ?? '');
      break;
    }
    case 'cross-reference': {
      const targetId = field.crossReferenceTargetId ?? '';
      const target = resolveCrossReferenceTarget(manuscript, targetId);
      value = formatCrossReferenceLabel({ targetId, displayStyle: field.crossReferenceDisplayStyle ?? 'label-number' }, target, locale);
      if (!target) value = '';
      break;
    }
    case 'current-date':
      value = formatDate(now, locale, field.dateStyle ?? 'medium');
      break;
    case 'section-count':
      value = String(manuscript.sections.length);
      break;
    case 'word-count':
      value = String(countManuscriptWords(manuscript));
      break;
  }
  return value || field.fallback || '';
}

export function validateComputedFields(
  manuscript: OmiManuscriptState & { semanticFields?: OmiSemanticField[]; computedFields?: OmiComputedField[] },
): OmiComputedFieldValidationIssue[] {
  const issues: OmiComputedFieldValidationIssue[] = [];
  const semanticIds = new Set((manuscript.semanticFields ?? []).map((field) => field.id));
  for (const field of manuscript.computedFields ?? []) {
    if (!field.label?.trim()) issues.push({ fieldId: field.id, type: 'missing-label' });
    if (field.kind === 'document-property' && !field.property) issues.push({ fieldId: field.id, type: 'missing-property' });
    if (field.kind === 'semantic-field' && (!field.semanticFieldId || !semanticIds.has(field.semanticFieldId))) {
      issues.push({ fieldId: field.id, type: 'missing-semantic-field' });
    }
    if (field.kind === 'cross-reference' && (!field.crossReferenceTargetId || !resolveCrossReferenceTarget(manuscript, field.crossReferenceTargetId))) {
      issues.push({ fieldId: field.id, type: 'missing-cross-reference-target' });
    }
  }
  return issues;
}

export function countManuscriptWords(manuscript: Pick<OmiManuscriptState, 'title' | 'subtitle' | 'abstract' | 'sections'>): number {
  const text = [
    manuscript.title,
    manuscript.subtitle ?? '',
    manuscript.abstract ?? '',
    ...manuscript.sections.flatMap((section) => [section.title, ...section.blocks.map((block) => plainText(block.content))]),
  ].join(' ');
  const words = text.trim().match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu);
  return words?.length ?? 0;
}

function resolveDocumentProperty(
  manuscript: OmiManuscriptState,
  property: OmiComputedDocumentProperty | undefined,
  locale: string,
  dateStyle: OmiComputedField['dateStyle'],
): string {
  switch (property) {
    case 'title': return manuscript.title;
    case 'subtitle': return manuscript.subtitle ?? '';
    case 'locale': return manuscript.locale;
    case 'created-at': return formatDate(new Date(manuscript.createdAt), locale, dateStyle ?? 'medium');
    case 'updated-at': return formatDate(new Date(manuscript.updatedAt), locale, dateStyle ?? 'medium');
    default: return '';
  }
}

function formatDate(value: Date, locale: string, style: NonNullable<OmiComputedField['dateStyle']>): string {
  if (Number.isNaN(value.getTime())) return '';
  if (style === 'iso') return value.toISOString().slice(0, 10);
  return new Intl.DateTimeFormat(locale, { dateStyle: style }).format(value);
}

function plainText(content: string): string {
  try { return collectNodeText(JSON.parse(content) as unknown); }
  catch { return content.replace(/<[^>]+>/g, ' '); }
}

function collectNodeText(value: unknown): string {
  if (!value || typeof value !== 'object') return '';
  const node = value as { text?: unknown; content?: unknown };
  return `${typeof node.text === 'string' ? node.text : ''}${Array.isArray(node.content) ? node.content.map(collectNodeText).join('') : ''}`;
}

function validateDefinition(input: CreateComputedFieldInput): void {
  if (input.kind === 'document-property' && !input.property) throw new Error('A document-property computed field requires a property.');
  if (input.kind === 'semantic-field' && !input.semanticFieldId?.trim()) throw new Error('A semantic-field computed field requires a semantic field target.');
  if (input.kind === 'cross-reference' && !input.crossReferenceTargetId?.trim()) throw new Error('A cross-reference computed field requires a target.');
}

function createStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** Dynamic semantic values resolved from manuscript state rather than stored presentation text. */
    computedFields?: OmiComputedField[];
  }
}
