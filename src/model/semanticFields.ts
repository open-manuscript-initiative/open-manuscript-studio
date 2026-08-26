import type { OmiManuscriptState } from '../types/omi';

export type OmiSemanticFieldValueType =
  | 'text'
  | 'rich-text'
  | 'date'
  | 'boolean'
  | 'choice';

export type OmiSemanticFieldScope = 'manuscript' | 'section';

export interface OmiSemanticField {
  /** Stable identity independent from the visible label or current value. */
  id: string;
  /** Machine-readable scholarly role, e.g. funding-statement. */
  role: string;
  /** Human-facing label supplied by a template or author. */
  label: string;
  valueType: OmiSemanticFieldValueType;
  value: string | boolean | null;
  required?: boolean;
  options?: string[];
  scope?: OmiSemanticFieldScope;
  sectionId?: string;
  /** Locked fields remain readable but cannot be edited through the normal author UI. */
  locked?: boolean;
  source?: {
    format?: string;
    tag?: string;
    alias?: string;
  };
  createdAt?: string;
  modifiedAt?: string;
}

export interface OmiSemanticFieldValidationIssue {
  fieldId: string;
  type:
    | 'missing-required-value'
    | 'invalid-choice'
    | 'missing-section'
    | 'invalid-role';
}

export interface CreateSemanticFieldInput {
  role: string;
  label: string;
  valueType?: OmiSemanticFieldValueType;
  value?: string | boolean | null;
  required?: boolean;
  options?: string[];
  scope?: OmiSemanticFieldScope;
  sectionId?: string;
  locked?: boolean;
  source?: OmiSemanticField['source'];
  id?: string;
}

export const SEMANTIC_FIELD_PRESETS: ReadonlyArray<{
  role: string;
  label: string;
  valueType: OmiSemanticFieldValueType;
}> = [
  { role: 'funding-statement', label: 'Funding statement', valueType: 'rich-text' },
  { role: 'conflict-of-interest', label: 'Conflict of interest', valueType: 'rich-text' },
  { role: 'ethics-statement', label: 'Ethics statement', valueType: 'rich-text' },
  { role: 'data-availability', label: 'Data availability statement', valueType: 'rich-text' },
  { role: 'acknowledgements', label: 'Acknowledgements', valueType: 'rich-text' },
  { role: 'publication-date', label: 'Publication date', valueType: 'date' },
];

export function createSemanticField(
  input: CreateSemanticFieldInput,
  timestamp = new Date().toISOString(),
): OmiSemanticField {
  const role = normalizeSemanticRole(input.role);
  const label = input.label.trim().replace(/\s+/g, ' ');
  if (!role) throw new Error('A semantic field role is required.');
  if (!label) throw new Error('A semantic field label is required.');

  const valueType = input.valueType ?? 'text';
  const options = normalizeOptions(input.options);
  if (valueType === 'choice' && options.length === 0) {
    throw new Error('A choice field requires at least one option.');
  }

  const scope = input.scope ?? 'manuscript';
  if (scope === 'section' && !input.sectionId?.trim()) {
    throw new Error('A section-scoped semantic field requires a section target.');
  }

  return {
    id: input.id ?? createStableId('field'),
    role,
    label,
    valueType,
    value: normalizeValue(input.value, valueType, options),
    required: input.required ?? false,
    ...(options.length ? { options } : {}),
    scope,
    ...(scope === 'section' && input.sectionId ? { sectionId: input.sectionId } : {}),
    locked: input.locked ?? false,
    ...(input.source ? { source: input.source } : {}),
    createdAt: timestamp,
    modifiedAt: timestamp,
  };
}

export function updateSemanticField(
  field: OmiSemanticField,
  patch: Partial<Omit<OmiSemanticField, 'id' | 'createdAt'>>,
  timestamp = new Date().toISOString(),
): OmiSemanticField {
  const valueType = patch.valueType ?? field.valueType;
  const options = normalizeOptions(patch.options ?? field.options);
  const scope = patch.scope ?? field.scope ?? 'manuscript';
  const role = patch.role === undefined ? field.role : normalizeSemanticRole(patch.role);
  const label = patch.label === undefined
    ? field.label
    : patch.label.trim().replace(/\s+/g, ' ');

  if (!role || !label) return field;
  if (valueType === 'choice' && options.length === 0) return field;
  if (scope === 'section' && !(patch.sectionId ?? field.sectionId)?.trim()) return field;

  return {
    ...field,
    ...patch,
    role,
    label,
    valueType,
    value: normalizeValue(
      patch.value === undefined ? field.value : patch.value,
      valueType,
      options,
    ),
    ...(options.length ? { options } : { options: undefined }),
    scope,
    sectionId: scope === 'section' ? (patch.sectionId ?? field.sectionId) : undefined,
    modifiedAt: timestamp,
  };
}

export function validateSemanticFields(
  manuscript: Pick<OmiManuscriptState, 'sections'> & { semanticFields?: OmiSemanticField[] },
): OmiSemanticFieldValidationIssue[] {
  const issues: OmiSemanticFieldValidationIssue[] = [];
  const sectionIds = new Set(manuscript.sections.map((section) => section.id));

  for (const field of manuscript.semanticFields ?? []) {
    if (!normalizeSemanticRole(field.role)) {
      issues.push({ fieldId: field.id, type: 'invalid-role' });
    }
    if (field.required && isEmptyValue(field.value)) {
      issues.push({ fieldId: field.id, type: 'missing-required-value' });
    }
    if (
      field.valueType === 'choice' &&
      typeof field.value === 'string' &&
      field.value &&
      !(field.options ?? []).includes(field.value)
    ) {
      issues.push({ fieldId: field.id, type: 'invalid-choice' });
    }
    if (
      field.scope === 'section' &&
      (!field.sectionId || !sectionIds.has(field.sectionId))
    ) {
      issues.push({ fieldId: field.id, type: 'missing-section' });
    }
  }

  return issues;
}

export function normalizeSemanticRole(value: string): string {
  return value
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeOptions(values: readonly string[] | undefined): string[] {
  return Array.from(new Set(
    (values ?? []).map((value) => value.trim()).filter(Boolean),
  ));
}

function normalizeValue(
  value: string | boolean | null | undefined,
  valueType: OmiSemanticFieldValueType,
  options: readonly string[],
): string | boolean | null {
  if (valueType === 'boolean') return typeof value === 'boolean' ? value : false;
  if (value === null || value === undefined) return '';
  const text = typeof value === 'string' ? value : String(value);
  if (valueType === 'choice' && text && !options.includes(text)) return '';
  return text;
}

function isEmptyValue(value: string | boolean | null): boolean {
  return value === null || (typeof value === 'string' && !value.trim());
}

function createStableId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

declare module '../types/omi' {
  interface OmiManuscriptState {
    /** Typed, machine-readable scholarly fields analogous to Word content controls. */
    semanticFields?: OmiSemanticField[];
  }
}
